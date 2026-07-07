'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { X, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WordCloud } from './WordCloud'
import { createClient } from '@/utils/supabase/client'

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
}

interface StepDef {
  step_id: string
  title: string
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
}: ResponseSummaryPanelProps) {
  const normType = normaliseType(responseType)
  const isTextBased = normType === 'text_short' || normType === 'text_long'

  // ── All responses for this step (live) ──────────────────────────────────
  const [allResponses, setAllResponses] = useState<ResponseRow[]>(
    initialResponses.filter(r => r.step_id === stepId)
  )
  // Cross-step responses (all steps) — for cross-filter computation
  const [allSessionResponses, setAllSessionResponses] = useState<ResponseRow[]>(initialResponses)

  // ── Word cloud filter ────────────────────────────────────────────────────
  const [activeWord, setActiveWord] = useState<string | null>(null)

  // ── Cross-filter state ───────────────────────────────────────────────────
  const [crossStepId, setCrossStepId] = useState<string>('')
  const [crossText, setCrossText] = useState<string>('')

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

  // ── Latest-per-student deduplication (current step) ─────────────────────
  const latestResponses = useMemo(() => latestPerStudent(allResponses), [allResponses])

  // ── Cross-filter: compute allowed student IDs ────────────────────────────
  const crossFilteredStudentIds = useMemo(() => {
    if (!crossStepId || !crossText.trim()) return null
    const priorForStep = allSessionResponses.filter(r => r.step_id === crossStepId)
    const latestPrior = latestPerStudent(priorForStep)
    const lowerQuery = crossText.toLowerCase().trim()
    const matching = latestPrior.filter(r =>
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

  // ── Apply word filter to list (text steps only) ──────────────────────────
  const wordFilteredResponses = useMemo(() => {
    if (!activeWord) return visibleResponses
    return visibleResponses.filter(r =>
      r.response_value?.toLowerCase().includes(activeWord.toLowerCase())
    )
  }, [visibleResponses, activeWord])

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

  // ── Texts for word cloud ─────────────────────────────────────────────────
  const cloudTexts = useMemo(
    () => visibleResponses.map(r => r.response_value).filter(Boolean),
    [visibleResponses]
  )

  const resetCrossFilter = useCallback(() => {
    setCrossStepId('')
    setCrossText('')
  }, [])

  // Steps that have a learner_response (excluding the current step)
  const filterableSteps = useMemo(
    () => allSteps.filter(s => s.learner_response && s.step_id !== stepId),
    [allSteps, stepId]
  )

  const hasCrossFilter = !!(crossStepId && crossText.trim())
  const hasWordFilter = !!activeWord
  const totalCount = latestResponses.length
  const visibleCount = visibleResponses.length

  return (
    <div className="flex flex-col h-full">
      {/* ── Top filter bar ── */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
          Filter by prior question
        </div>
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

        {/* Active filter summary */}
        {hasCrossFilter && (
          <p className="mt-2 text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{visibleCount}</span> of{' '}
            <span className="font-semibold text-slate-700">{totalCount}</span> responses where
            prior answer contains &ldquo;<span className="text-blue-600 font-medium">{crossText}</span>&rdquo;
          </p>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Response count pill */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">
            {visibleCount} {visibleCount === 1 ? 'response' : 'responses'}
            {hasCrossFilter && ` (filtered from ${totalCount})`}
          </span>
          {(hasWordFilter) && (
            <button
              onClick={() => setActiveWord(null)}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
            >
              <X className="w-3 h-3" />
              &ldquo;{activeWord}&rdquo;
            </button>
          )}
        </div>

        {/* ────── TEXT-BASED: Word cloud + response list ────── */}
        {isTextBased && (
          <>
            <div className="bg-white border border-slate-100 rounded-xl p-4 overflow-hidden shadow-sm">
              {cloudTexts.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                  No responses yet
                </div>
              ) : (
                <WordCloud
                  texts={cloudTexts}
                  activeWord={activeWord}
                  onWordClick={(word) =>
                    setActiveWord(prev => (prev === word ? null : word))
                  }
                />
              )}
              {cloudTexts.length > 0 && (
                <p className="text-center text-xs text-slate-400 mt-2">
                  Click a word to filter responses
                </p>
              )}
            </div>

            {/* Response list */}
            <div className="space-y-2">
              {wordFilteredResponses.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No responses match the current filter.
                </p>
              ) : (
                wordFilteredResponses.map((r) => (
                  <ResponseListItem key={r.id} value={r.response_value} highlight={activeWord} />
                ))
              )}
            </div>
          </>
        )}

        {/* ────── CHOICE-BASED: Donut chart ────── */}
        {!isTextBased && (
          <>
            {donutData.filter(d => d.value > 0).length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                No responses yet
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden" style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData.filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={104}
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
function ResponseListItem({ value, highlight }: { value: string; highlight?: string | null }) {
  if (!highlight) {
    return (
      <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm text-slate-700 leading-relaxed">
        {value}
      </div>
    )
  }

  // Split on highlight word (case-insensitive) and re-join with <mark>
  const parts = value.split(new RegExp(`(${highlight})`, 'gi'))
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5 text-sm text-slate-700 leading-relaxed">
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  )
}
