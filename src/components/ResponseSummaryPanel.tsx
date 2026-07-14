'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { X, ChevronDown, Sparkles, RefreshCw, AlertCircle, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { WordCloud } from './WordCloud'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResponseType = 'text_short' | 'text_long' | 'multiple_choice' | 'dropdown' | 'open_ended' | 'short_answer'

interface ResponseRow {
  id: string
  student_id: string
  step_id: string
  response_value: string
  submitted_at: string
  students?: {
    name: string
  } | null
}

interface StepDef {
  step_id: string
  title: string
  instruction_text?: string | null
  learner_response?: {
    response_type?: string
    options?: string[]
  } | null
}

interface ResponseSummaryPanelProps {
  sessionId: string
  stepId: string
  responseType: ResponseType
  options?: string[]
  /** All steps in the lesson — used for cross-filter step selection */
  allSteps: StepDef[]
  /** Initial snapshot of responses (SSR pre-fetched); real-time updates on top */
  initialResponses: ResponseRow[]
  onClose: () => void
  autoGenerateSummary?: boolean
  isCompact?: boolean
  layout?: 'panel' | 'overlay'
}

// ---------------------------------------------------------------------------
// Colour palette for donut chart segments
// ---------------------------------------------------------------------------
const DONUT_COLOURS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#0ea5e9', // sky-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#f43f5e', // rose-500
  '#84cc16', // lime-500
]

// ---------------------------------------------------------------------------
// Normalise legacy response type names
// ---------------------------------------------------------------------------
function normaliseType(t: string | undefined): ResponseType {
  if (t === 'open_ended') return 'text_long'
  if (t === 'short_answer') return 'text_short'
  return (t as ResponseType) ?? 'text_short'
}

// ---------------------------------------------------------------------------
// Deduplicate responses — latest submission per student wins
// ---------------------------------------------------------------------------
function latestPerStudent(rows: ResponseRow[]): ResponseRow[] {
  const map = new Map<string, ResponseRow>()
  // Sort ascending so later entries overwrite
  const sorted = [...rows].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  )
  for (const r of sorted) {
    if (r.response_value?.trim()) map.set(r.student_id, r)
  }
  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Custom donut centre label
// ---------------------------------------------------------------------------
function DonutCentreLabel({ viewBox, total }: { viewBox?: { cx: number; cy: number }; total: number }) {
  const { cx = 0, cy = 0 } = viewBox ?? {}
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" fontSize={24} fontWeight={700} fill="#1e293b">
        {total}
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize={11} fill="#94a3b8">
        {total === 1 ? 'response' : 'responses'}
      </tspan>
    </text>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ResponseSummaryPanel({
  sessionId,
  stepId,
  responseType,
  options = [],
  allSteps,
  initialResponses,
  onClose,
  autoGenerateSummary = true,
  isCompact = false,
  layout = 'panel',
}: ResponseSummaryPanelProps) {
  const normType = normaliseType(responseType)
  const isTextBased = normType === 'text_short' || normType === 'text_long'

  // ── All responses for this step (live) ──────────────────────────────────
  const [allResponses, setAllResponses] = useState<ResponseRow[]>(
    initialResponses.filter(r => r.step_id === stepId)
  )
  // Cross-step responses (all steps) — for cross-filter computation
  const [allSessionResponses, setAllSessionResponses] = useState<ResponseRow[]>(initialResponses)

  // ── Student Names Cache ──────────────────────────────────────────────────
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})

  // Initialize studentNames from initialResponses
  useEffect(() => {
    const namesMap: Record<string, string> = {}
    initialResponses.forEach(r => {
      if (r.students?.name) {
        namesMap[r.student_id] = r.students.name
      }
    })
    setStudentNames(prev => ({ ...prev, ...namesMap }))
  }, [initialResponses])

  // ── Cross-filter state ───────────────────────────────────────────────────
  const [crossStepId, setCrossStepId] = useState<string>('')
  const [crossText, setCrossText] = useState<string>('')

  // ── AI Summary states ────────────────────────────────────────────────────
  interface AISummaryPoint {
    title: string
    synthesis: string
    matchingResponseIds: string[]
  }

  interface AISummaryData {
    summaryPoints: AISummaryPoint[]
  }

  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null)
  const [activeBulletId, setActiveBulletId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'ai' | 'cloud'>('ai')
  const [activeWord, setActiveWord] = useState<string | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [summaryCount, setSummaryCount] = useState<number>(0)
  const [summaryTimestamp, setSummaryTimestamp] = useState<string | null>(null)

  // ── Latest-per-student deduplication (current step) ─────────────────────
  const latestResponses = useMemo(() => latestPerStudent(allResponses), [allResponses])

  // ── Cross-filter: compute allowed student IDs ────────────────────────────
  const crossFilteredStudentIds = useMemo(() => {
    if (!crossStepId || !crossText.trim()) return null
    const priorForStep = allSessionResponses.filter(r => r.step_id === crossStepId)
    const legacyDeduplicate = latestPerStudent(priorForStep)
    const lowerQuery = crossText.toLowerCase().trim()
    const matching = legacyDeduplicate.filter(r =>
      r.response_value?.toLowerCase().includes(lowerQuery)
    )
    return new Set(matching.map(r => r.student_id))
  }, [crossStepId, crossText, allSessionResponses])

  // ── Apply cross-filter to current responses ──────────────────────────────
  const visibleResponses = useMemo(() => {
    let rows = latestResponses
    if (crossFilteredStudentIds) {
      rows = rows.filter(r => crossFilteredStudentIds.has(r.student_id))
    }
    return rows
  }, [latestResponses, crossFilteredStudentIds])

  // ── Texts for word cloud ─────────────────────────────────────────────────
  const cloudTexts = useMemo(
    () => visibleResponses.map(r => r.response_value).filter(Boolean),
    [visibleResponses]
  )

  // ── Apply word filter to list (text steps only) ──────────────────────────
  const wordFilteredResponses = useMemo(() => {
    if (!activeWord) return visibleResponses
    return visibleResponses.filter(r =>
      r.response_value?.toLowerCase().includes(activeWord.toLowerCase())
    )
  }, [visibleResponses, activeWord])

  const normalizedSummary = useMemo<AISummaryData | null>(() => {
    if (!aiSummary) return null

    // If it has summaryPoints (new format), return as is
    if ('summaryPoints' in aiSummary && Array.isArray(aiSummary.summaryPoints)) {
      return aiSummary as AISummaryData
    }

    // If it has goals (old format), map it dynamically
    const legacy = aiSummary as any
    if (legacy.goals && Array.isArray(legacy.goals)) {
      const summaryPoints = legacy.goals.flatMap((goal: any) => {
        return (goal.levels || []).map((level: any) => ({
          title: `“${level.subSkill}”`,
          synthesis: level.observedPattern || '',
          matchingResponseIds: level.matchingResponseIds || [],
        }))
      })
      return {
        summaryPoints,
      }
    }

    return null
  }, [aiSummary])

  // ── Donut data ───────────────────────────────────────────────────────────
  const donutData = useMemo(() => {
    if (isTextBased) return []
    const effectiveOptions = options.length > 0 ? options : [
      ...new Set(visibleResponses.map(r => r.response_value).filter(Boolean))
    ]
    return effectiveOptions.map(opt => ({
      name: opt,
      value: visibleResponses.filter(r => r.response_value === opt).length,
    })).filter(d => d.value > 0 || options.length > 0)
  }, [isTextBased, options, visibleResponses])

  // ── AI Summary Caching & Fetching Memos / Hooks ──────────────────────────
  const latestResponseTime = useMemo(() => {
    if (visibleResponses.length === 0) return null
    return new Date(Math.max(...visibleResponses.map(r => new Date(r.submitted_at).getTime()))).toISOString()
  }, [visibleResponses])

  const hasNewResponses = useMemo(() => {
    if (!aiSummary) return false
    const isTimestampMatch = (() => {
      if (!summaryTimestamp && !latestResponseTime) return true
      if (!summaryTimestamp || !latestResponseTime) return false
      return new Date(summaryTimestamp).getTime() === new Date(latestResponseTime).getTime()
    })()
    return visibleResponses.length !== summaryCount || !isTimestampMatch
  }, [aiSummary, visibleResponses.length, summaryCount, latestResponseTime, summaryTimestamp])

  const fetchSummary = useCallback(async (checkCache: boolean = false, forceRefresh: boolean = false) => {
    if (!sessionId || !stepId) return
    setIsSummaryLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, stepId, checkCache, forceRefresh }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errData = await res.json()
        if (errData.error === 'GEMINI_KEY_MISSING') {
          setApiError('GEMINI_KEY_MISSING')
        } else {
          setApiError(errData.error || 'Failed to generate summary')
        }
        return
      }

      const data = await res.json()
      if (data.summary) {
        setAiSummary(data.summary)
        setSummaryCount(data.count || 0)
        setSummaryTimestamp(data.lastResponseAt || null)
      } else {
        setAiSummary(null)
      }
    } catch (err: any) {
      console.error('[ResponseSummaryPanel] fetchSummary error', err)
      setApiError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSummaryLoading(false)
    }
  }, [sessionId, stepId])

  // Load cached summary from database on mount if any exists (across all views)
  useEffect(() => {
    if (isTextBased && visibleResponses.length > 0 && !aiSummary && !isSummaryLoading && !apiError) {
      // Check cache first (only calls database, doesn't invoke Gemini)
      fetchSummary(true)
    }
  }, [isTextBased, visibleResponses.length, fetchSummary, aiSummary, isSummaryLoading, apiError])

  // If auto-generate is enabled and we still don't have a summary, run full Gemini fetch
  useEffect(() => {
    if (autoGenerateSummary && isTextBased && visibleResponses.length > 0 && !aiSummary && !isSummaryLoading && !apiError) {
      // Run full summary generation (calls Gemini if cache is stale or missing)
      fetchSummary(false)
    }
  }, [autoGenerateSummary, isTextBased, visibleResponses.length, fetchSummary, aiSummary, isSummaryLoading, apiError])

  const resetCrossFilter = useCallback(() => {
    setCrossStepId('')
    setCrossText('')
  }, [])

  // Steps that have a learner_response (excluding the current step)
  const filterableSteps = useMemo(
    () => allSteps.filter(s => s.learner_response && s.step_id !== stepId),
    [allSteps, stepId]
  )

  // ── Supabase realtime subscription ──────────────────────────────────────
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // Subscribe to all new response inserts for this session
    const channel = supabase
      .channel(`responses-session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newRow = payload.new as ResponseRow

          // Fetch student name dynamically if not cached yet
          setStudentNames(prev => {
            if (!prev[newRow.student_id]) {
              supabase
                .from('students')
                .select('name')
                .eq('id', newRow.student_id)
                .single()
                .then(({ data }) => {
                  if (data?.name) {
                    setStudentNames(curr => ({ ...curr, [newRow.student_id]: data.name }))
                  }
                })
            }
            return prev
          })

          // Add to cross-step responses
          setAllSessionResponses(prev => [...prev, newRow])
          // Add to current-step responses if relevant
          if (newRow.step_id === stepId) {
            setAllResponses(prev => [...prev, newRow])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, stepId, supabase])

  const hasCrossFilter = !!(crossStepId && crossText.trim())
  const totalCount = latestResponses.length
  const visibleCount = visibleResponses.length

  if (layout === 'overlay') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top of overlay: Title, Question and Responses count */}
        <div className="p-6 border-b border-slate-100 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Close overlay"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="pr-8">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              {allSteps.find(s => s.step_id === stepId)?.title || 'Question Insight'}
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-1 leading-snug">
              {allSteps.find(s => s.step_id === stepId)?.instruction_text || "No question for this step."}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 font-medium flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {visibleCount} {visibleCount === 1 ? 'response' : 'responses'} recorded
            </p>
          </div>
        </div>

        {/* Scrollable grid contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
          
          {/* Section 1: AI Summary / Response Breakdown (Top) */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-indigo-50/20 to-slate-50/50 border border-indigo-100/70 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-indigo-100/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                <h3 className="text-sm font-extrabold text-indigo-950 uppercase tracking-wider">
                  {isTextBased ? 'AI Summary' : 'Response Breakdown'}
                </h3>
              </div>
              
              {/* Regenerate Button in-line with the Title (top right of section) */}
              {isTextBased && visibleCount > 3 && normalizedSummary && (
                <div className="flex items-center gap-2">
                  {hasNewResponses && (
                    <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-250 animate-pulse uppercase tracking-wider">
                      New responses
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchSummary(false, true)}
                    disabled={isSummaryLoading}
                    className="h-8 text-xs border-indigo-100 bg-white text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
              )}
            </div>

            {visibleCount === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                No responses yet
              </div>
            ) : isTextBased ? (
              visibleCount <= 3 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                  AI summary requires more than 3 responses.
                </div>
              ) : normalizedSummary ? (
                /* 2-column grid for AI Summary Bullet points */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {normalizedSummary.summaryPoints.map((point, index) => {
                    const bulletId = `point-${index}`
                    const isActive = activeBulletId === bulletId
                    const pointResponses = visibleResponses.filter(r =>
                      point?.matchingResponseIds?.includes(r.id)
                    )

                    return (
                      <div
                        key={index}
                        onClick={() => {
                          setActiveBulletId(isActive ? null : bulletId);
                        }}
                        className={`text-xs p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col gap-2 ${
                          isActive
                            ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
                            : 'bg-white border-slate-100 hover:border-indigo-250 hover:bg-indigo-50/10'
                        }`}
                      >
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {point.title}
                        </h4>
                        <p className="text-slate-600 leading-relaxed">
                          {point.synthesis}
                        </p>

                        {isActive && (
                          <div className="mt-3 pt-3 border-t border-indigo-100/50 space-y-2">
                            <p className="text-[9px] uppercase font-extrabold text-indigo-500 tracking-wider">
                              Matching Responses
                            </p>
                            {pointResponses.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No responses match this point.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {pointResponses.map(r => (
                                  <div key={r.id} className="bg-white/80 p-2.5 rounded-lg border border-indigo-50/50 shadow-sm">
                                    <div className="font-bold text-slate-700 text-[10px] mb-0.5">{studentNames[r.student_id] || r.students?.name}</div>
                                    <div className="text-slate-600 leading-relaxed text-[11px]">{r.response_value}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center bg-white/60 rounded-xl border border-indigo-50/50 p-6">
                  <Sparkles className="w-8 h-8 text-indigo-300 mb-2" />
                  <p className="text-sm font-semibold text-indigo-900">AI Response Analysis</p>
                  <p className="text-xs text-indigo-550 max-w-[280px] mt-1 mb-3">
                    Analyze student responses against learning goals.
                  </p>
                  <Button
                    onClick={() => fetchSummary(false, true)}
                    disabled={isSummaryLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm h-8 cursor-pointer"
                  >
                    {isSummaryLoading ? 'Generating...' : 'Generate Summary'}
                  </Button>
                </div>
              )
            ) : (
              /* Choice-based: Show Donut Chart in 2 columns */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="bg-white border border-indigo-50/50 rounded-xl shadow-sm overflow-hidden flex items-center justify-center" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={600}
                        label={({ name, percent }) =>
                          `${Math.round((percent ?? 0) * 100)}%`
                        }
                        labelLine={false}
                      >
                        {donutData.filter(d => d.value > 0).map((_, i) => (
                          <Cell key={i} fill={DONUT_COLOURS[i % DONUT_COLOURS.length]} />
                        ))}
                        <DonutCentreLabel
                          viewBox={undefined}
                          total={visibleCount}
                        />
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value)} (${visibleCount > 0 ? Math.round((Number(value) / visibleCount) * 100) : 0}%)`,
                          String(name),
                        ]}
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 bg-white/60 p-4 rounded-xl border border-indigo-50/50">
                  {donutData.filter(d => d.value > 0).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: DONUT_COLOURS[i % DONUT_COLOURS.length] }}
                      />
                      <span className="text-xs text-slate-700 flex-1 truncate">{d.name}</span>
                      <span className="text-xs font-semibold text-slate-900">{d.value}</span>
                      <span className="text-[10px] text-slate-400 w-10 text-right">
                        {visibleCount > 0 ? Math.round((d.value / visibleCount) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Learner Responses (Bottom) */}
          <div>
            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Learner Responses
              </h3>
              <span className="text-xs font-semibold text-slate-400">({visibleCount})</span>
            </div>

            {visibleCount === 0 ? (
              <p className="text-sm text-slate-400 italic">No responses yet.</p>
            ) : (
              /* 2-column grid for Learner responses list */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {visibleResponses.map(r => (
                  <ResponseListItem
                    key={r.id}
                    value={r.response_value}
                    studentName={studentNames[r.student_id] || r.students?.name}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* ── Top filter bar (Functional but hidden visually as requested) ── */}
      {false && (
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex gap-2 items-center flex-wrap">
            {/* Step selector */}
            <div className="relative flex-1 min-w-[140px]">
              <select
                value={crossStepId}
                onChange={e => { setCrossStepId(e.target.value); setCrossText('') }}
                className="w-full appearance-none text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                aria-label="Select a prior question to filter by"
              >
                <option value="">Select a question…</option>
                {filterableSteps.map(s => (
                  <option key={s.step_id} value={s.step_id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Text match input */}
            {crossStepId && (
              <Input
                value={crossText}
                onChange={e => setCrossText(e.target.value)}
                placeholder="Filter text…"
                className="flex-1 min-w-[100px] text-sm h-9"
                aria-label="Filter text for selected question"
              />
            )}

            {/* Reset */}
            {hasCrossFilter && (
              <button
                onClick={resetCrossFilter}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                aria-label="Reset cross-filter"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className={`flex-1 overflow-y-auto space-y-4 ${isCompact ? 'px-0.5 py-1' : 'px-5 py-4'}`}>

        {visibleCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
            No responses yet
          </div>
        ) : (
          <>
            {/* Response count pill & icon-only tabs */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {visibleCount} {visibleCount === 1 ? 'response' : 'responses'}
                {hasCrossFilter && ` (filtered from ${totalCount})`}
              </span>
              <div className="flex items-center gap-2">
                {activeTab === 'cloud' && activeWord && (
                  <button
                    onClick={() => setActiveWord(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    &ldquo;{activeWord}&rdquo;
                  </button>
                )}

                {/* Icon-only tabs - only shown if > 3 responses */}
                {isTextBased && visibleCount > 3 && (
                  <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200/50">
                    <button
                      onClick={() => { setActiveTab('ai'); setActiveWord(null) }}
                      title="AI Summary"
                      className={`p-1 rounded transition-all ${
                        activeTab === 'ai'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setActiveTab('cloud'); setActiveBulletId(null) }}
                      title="Word Cloud"
                      className={`p-1 rounded transition-all ${
                        activeTab === 'cloud'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ────── TEXT-BASED: AI Summary + Word Cloud Tabs ────── */}
            {isTextBased && (
              <>

                {/* AI Summary View / Generate Button - only if > 3 responses and activeTab is 'ai' */}
                {visibleCount > 3 && activeTab === 'ai' && (
                  normalizedSummary ? (
                    /* AI goal summary details */
                    <div className={`bg-gradient-to-br from-indigo-50/90 via-blue-50/40 to-white border border-blue-100/80 shadow-md shadow-blue-100/20 rounded-xl overflow-hidden relative ${isCompact ? 'p-3' : 'p-5'}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-600/10 p-1.5 rounded-lg text-indigo-600">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">
                              AI Summary
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {hasNewResponses && (
                            <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-md border border-amber-100 animate-pulse">
                              New responses
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchSummary(false, true)}
                            disabled={isSummaryLoading}
                            className="h-8 text-xs border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 gap-1.5"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSummaryLoading ? 'animate-spin' : ''}`} />
                            Regenerate
                          </Button>
                        </div>
                      </div>

                      {/* State handling */}
                      {apiError ? (
                        <div className="border border-red-100 bg-red-50/40 rounded-lg p-4 text-sm text-slate-700 flex flex-col gap-2">
                          <div className="flex items-start gap-2 text-red-600">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold">Generation Failed</p>
                              <p className="text-xs text-slate-500 mt-0.5">{apiError}</p>
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() => fetchSummary(false, true)}
                                className="p-0 h-auto text-xs text-red-600 font-semibold underline hover:text-red-700 mt-2"
                              >
                                Try again
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : isSummaryLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Sparkles className="w-4 h-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            Analyzing student responses against learning goals...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(!normalizedSummary || !normalizedSummary.summaryPoints || normalizedSummary.summaryPoints.length === 0) ? (
                            <p className="text-xs text-slate-400 py-2">
                              Could not map responses to summary points.
                            </p>
                          ) : (
                            <div className="space-y-3.5">
                              {/* Render Main Summary Points */}
                              {normalizedSummary.summaryPoints.map((point: AISummaryPoint, index: number) => {
                                const bulletId = `point-${index}`
                                const isActive = activeBulletId === bulletId

                                // Get responses matching point
                                const pointResponses = visibleResponses.filter(r =>
                                  point.matchingResponseIds?.includes(r.id)
                                )

                                return (
                                  <div
                                    key={index}
                                    onClick={() => setActiveBulletId(isActive ? null : bulletId)}
                                    className={`text-xs p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col gap-2 ${
                                      isActive
                                        ? 'bg-blue-50/70 border-blue-200 shadow-sm'
                                        : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-white/70'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex flex-col gap-1.5 flex-1">
                                        <h4 className="text-sm font-bold text-slate-900 pl-0.5 leading-snug">
                                          {point.title}
                                        </h4>
                                        <p className="text-slate-650 leading-relaxed pl-0.5">
                                          {point.synthesis}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Inline matching responses */}
                                    {isActive && (
                                      <div className="mt-2 pt-3 border-t border-blue-100/40 space-y-2 animate-fadeIn">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-0.5 mb-1">
                                          Tagged Student Answers
                                        </p>
                                        <div className="space-y-1.5">
                                          {pointResponses.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic pl-0.5">No responses tagged.</p>
                                          ) : (
                                            pointResponses.map((r) => (
                                              <div
                                                key={r.id}
                                                className="p-2.5 rounded-lg text-xs leading-relaxed bg-slate-50 border border-slate-100/70 flex flex-col gap-1"
                                              >
                                                <span className="text-slate-700 font-normal">{r.response_value}</span>
                                                {studentNames[r.student_id] && (
                                                  <span className="text-[9px] text-slate-400 self-end">
                                                    — {studentNames[r.student_id]}
                                                  </span>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                            </div>
                          )}
                          <p className="text-center text-[10px] text-slate-400 mt-2">
                            Click a card to view matching answers inline. Click again to close.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Generate Summary secondary styled button */
                    <div className="mb-2">
                      <Button
                        variant="secondary"
                        onClick={() => fetchSummary(false, true)}
                        disabled={isSummaryLoading}
                        className="w-full py-2 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        {isSummaryLoading ? "Regenerating..." : "Regenerate"}
                      </Button>
                      {apiError && (
                        <div className="mt-2 text-xs text-red-500 border border-red-100 bg-red-50/30 p-2 rounded">
                          {apiError}
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Word Cloud view - only if > 3 responses and activeTab is 'cloud' */}
                {visibleCount > 3 && activeTab === 'cloud' && (
                  <div className={`bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm ${isCompact ? 'p-2' : 'p-4'}`}>
                    <WordCloud
                      texts={cloudTexts}
                      activeWord={activeWord}
                      onWordClick={(word) =>
                        setActiveWord(prev => (prev === word ? null : word))
                      }
                    />
                    {cloudTexts.length > 0 && (
                      <p className="text-center text-xs text-slate-400 mt-2">
                        Click a word to filter responses below
                      </p>
                    )}
                  </div>
                )}

                {/* Response list */}
                <div className="space-y-2">
                  {visibleCount <= 3 || activeTab !== 'cloud' ? (
                    visibleResponses.map((r) => (
                      <ResponseListItem
                        key={r.id}
                        value={r.response_value}
                        studentName={studentNames[r.student_id] || r.students?.name}
                      />
                    ))
                  ) : (
                    wordFilteredResponses.map((r) => (
                      <ResponseListItem
                        key={r.id}
                        value={r.response_value}
                        highlight={activeWord}
                        studentName={studentNames[r.student_id] || r.students?.name}
                      />
                    ))
                  )}
                </div>
              </>
            )}

            {/* ────── CHOICE-BASED: Donut chart ────── */}
            {!isTextBased && (
              <>
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden" style={{ height: isCompact ? 180 : 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={isCompact ? 45 : 72}
                        outerRadius={isCompact ? 65 : 104}
                        paddingAngle={2}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={600}
                        label={({ name, percent }) =>
                          `${Math.round((percent ?? 0) * 100)}%`
                        }
                        labelLine={false}
                      >
                        {donutData.filter(d => d.value > 0).map((_, i) => (
                          <Cell key={i} fill={DONUT_COLOURS[i % DONUT_COLOURS.length]} />
                        ))}
                        <DonutCentreLabel
                          viewBox={undefined}
                          total={visibleCount}
                        />
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value)} (${visibleCount > 0 ? Math.round((Number(value) / visibleCount) * 100) : 0}%)`,
                          String(name),
                        ]}
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: 13,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span className="text-xs text-slate-600">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Option breakdown list */}
                <div className="space-y-2">
                  {donutData.filter(d => d.value > 0).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: DONUT_COLOURS[i % DONUT_COLOURS.length] }}
                      />
                      <span className="text-sm text-slate-700 flex-1 truncate">{d.name}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{d.value}</span>
                      <span className="text-xs text-slate-400 tabular-nums w-10 text-right">
                        {visibleCount > 0 ? Math.round((d.value / visibleCount) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Response list item with word highlight
// ---------------------------------------------------------------------------
function ResponseListItem({
  value,
  studentName,
  isExemplar,
  highlight,
}: {
  value: string
  studentName?: string
  isExemplar?: boolean
  highlight?: string | null
}) {
  const content = (() => {
    if (!highlight) {
      return <span>{value}</span>
    }
    const parts = value.split(new RegExp(`(${highlight})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-100 text-yellow-800 rounded px-0.5">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    )
  })()

  return (
    <div
      className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed flex flex-col gap-1 transition-all ${
        isExemplar
          ? 'bg-amber-50/50 border-l-4 border-l-amber-400 border-y border-r border-amber-200/60 shadow-sm'
          : 'bg-slate-50 border border-slate-100'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-slate-755 font-normal">{content}</span>
        {isExemplar && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider shrink-0 select-none">
            ★ AI Exemplar
          </span>
        )}
      </div>
      {studentName && (
        <span className="text-[11px] text-slate-400 self-end mt-0.5 font-normal tracking-wide">
          — {studentName}
        </span>
      )}
    </div>
  )
}
