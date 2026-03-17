'use client'

import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, ListChecks, Users, Eye, Clock, MousePointerClick, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

interface StudentRow {
  id: string
  name: string
  joined_at: string
}

interface ResponseRow {
  id: string
  student_id: string
  step_id: string
  response_value: string
  submitted_at: string
}

interface EventRow {
  id: string
  student_id: string
  step_id: string
  event_type: string
  created_at: string
}

interface StepDef {
  step_id: string
  title: string
  learner_response?: { response_required?: boolean }
}

interface SessionAnalyticsProps {
  selectedStepsJson: { activities: { activity_title: string; steps: StepDef[] }[] }
  students: StudentRow[]
  responses: ResponseRow[]
  events: EventRow[]
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function SessionAnalytics({ selectedStepsJson, students, responses, events }: SessionAnalyticsProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())

  const toggleStudent = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  // Flatten steps from session config maintaining order
  const allSteps = useMemo(() => {
    const steps: StepDef[] = []
    selectedStepsJson.activities?.forEach(act => {
      act.steps?.forEach(step => steps.push(step))
    })
    return steps
  }, [selectedStepsJson])

  // ===== TIMELINE CHART DATA =====
  const timelineData = useMemo(() => {
    if (responses.length === 0) return []
    
    const sorted = [...responses].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    
    const firstTime = new Date(sorted[0].submitted_at).getTime()
    const lastTime = new Date(sorted[sorted.length - 1].submitted_at).getTime()
    const rangeMs = lastTime - firstTime
    
    let binMs = 5 * 60 * 1000
    if (rangeMs < 30 * 60 * 1000) binMs = 2 * 60 * 1000
    else if (rangeMs > 2 * 60 * 60 * 1000) binMs = 15 * 60 * 1000
    
    const bins: Record<number, Set<string>> = {}
    sorted.forEach(r => {
      const t = new Date(r.submitted_at).getTime()
      const binKey = Math.floor(t / binMs) * binMs
      if (!bins[binKey]) bins[binKey] = new Set()
      bins[binKey].add(r.student_id)
    })
    
    students.forEach(s => {
      const t = new Date(s.joined_at).getTime()
      const binKey = Math.floor(t / binMs) * binMs
      if (!bins[binKey]) bins[binKey] = new Set()
      bins[binKey].add(s.id)
    })
    
    return Object.entries(bins)
      .map(([key, studentSet]) => ({
        time: Number(key),
        label: format(new Date(Number(key)), 'HH:mm'),
        students: studentSet.size,
      }))
      .sort((a, b) => a.time - b.time)
  }, [responses, students])

  // ===== STEP BREAKDOWN DATA =====
  const stepBreakdown = useMemo(() => {
    const studentJoinMap: Record<string, number> = {}
    students.forEach(s => { studentJoinMap[s.id] = new Date(s.joined_at).getTime() })

    const studentResponses: Record<string, ResponseRow[]> = {}
    responses.forEach(r => {
      if (!studentResponses[r.student_id]) studentResponses[r.student_id] = []
      studentResponses[r.student_id].push(r)
    })
    Object.values(studentResponses).forEach(arr => arr.sort((a, b) =>
      new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    ))

    return allSteps.map((step, idx) => {
      const stepResponses = responses.filter(r => r.step_id === step.step_id)
      // Unique students who answered this step
      const uniqueStudentIds = new Set(stepResponses.map(r => r.student_id))
      const stepEvents = events.filter(e => e.step_id === step.step_id)
      const mediaClicks = stepEvents.filter(e => e.event_type.includes('media') || e.event_type.includes('click'))

      const times: number[] = []
      Object.entries(studentResponses).forEach(([studentId, sResponses]) => {
        const thisIdx = sResponses.findIndex(r => r.step_id === step.step_id)
        if (thisIdx === -1) return
        const endTime = new Date(sResponses[thisIdx].submitted_at).getTime()
        const startTime = thisIdx > 0
          ? new Date(sResponses[thisIdx - 1].submitted_at).getTime()
          : (studentJoinMap[studentId] || endTime)
        if (endTime > startTime) times.push(endTime - startTime)
      })
      const avgTimeMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0

      // Group responses by student, sorted newest first within each group
      const byStudent: Record<string, ResponseRow[]> = {}
      stepResponses.forEach(r => {
        if (!byStudent[r.student_id]) byStudent[r.student_id] = []
        byStudent[r.student_id].push(r)
      })
      Object.values(byStudent).forEach(arr => arr.sort((a, b) =>
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      ))

      return {
        step,
        index: idx,
        uniqueCompleted: uniqueStudentIds.size,
        avgTimeMs,
        avgMediaClicks: uniqueStudentIds.size > 0 ? Math.round((mediaClicks.length / uniqueStudentIds.size) * 10) / 10 : 0,
        hasResponses: step.learner_response?.response_required,
        responsesByStudent: byStudent,
        totalResponses: stepResponses.length,
      }
    })
  }, [allSteps, responses, events, students])

  // ===== STUDENT BREAKDOWN DATA =====
  const studentBreakdown = useMemo(() => {
    const studentJoinMap: Record<string, number> = {}
    students.forEach(s => { studentJoinMap[s.id] = new Date(s.joined_at).getTime() })

    return students.map(student => {
      const sResponses = responses
        .filter(r => r.student_id === student.id)
        .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
      
      const sEvents = events.filter(e => e.student_id === student.id)

      const stepDetails = allSteps.map((step) => {
        // Get ALL responses for this step, sorted newest first
        const allStepResponses = sResponses
          .filter(r => r.step_id === step.step_id)
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        const latestResponse = allStepResponses[0] || null
        const stepMediaEvents = sEvents.filter(e => e.step_id === step.step_id && (e.event_type.includes('media') || e.event_type.includes('click')))
        
        let timeMs = 0
        if (latestResponse) {
          // Use first response for time calculation (original attempt)
          const firstResponse = allStepResponses[allStepResponses.length - 1]
          const endTime = new Date(firstResponse.submitted_at).getTime()
          const firstResponseIdx = sResponses.indexOf(firstResponse)
          const startTime = firstResponseIdx > 0
            ? new Date(sResponses[firstResponseIdx - 1].submitted_at).getTime()
            : (studentJoinMap[student.id] || endTime)
          timeMs = endTime - startTime
        }

        return {
          step,
          completed: !!latestResponse,
          responseValue: latestResponse?.response_value || null,
          allResponses: allStepResponses,
          versionCount: allStepResponses.length,
          timeMs,
          mediaClicks: stepMediaEvents.length,
        }
      })

      const completedSteps = stepDetails.filter(sd => sd.completed).length
      const totalTimeMs = stepDetails.reduce((sum, sd) => sum + sd.timeMs, 0)
      const lastCompleted = [...stepDetails].reverse().find(sd => sd.completed)

      return {
        student,
        completedSteps,
        totalSteps: allSteps.length,
        completionPct: allSteps.length > 0 ? Math.round((completedSteps / allSteps.length) * 100) : 0,
        totalTimeMs,
        lastStepName: lastCompleted?.step.title || '—',
        stepDetails,
      }
    })
  }, [students, responses, events, allSteps])

  return (
    <div className="space-y-6">
      {/* Timeline Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-base font-semibold text-slate-800">Student Activity Timeline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {timelineData.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Activity data will populate as students interact with the lesson.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  formatter={(value) => [`${value} student${value !== 1 ? 's' : ''}`, 'Active']}
                />
                <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed View Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-800">Detailed Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="by-step">
            <TabsList className="mb-6">
              <TabsTrigger value="by-step" className="gap-1.5"><ListChecks className="w-4 h-4" /> By Step</TabsTrigger>
              <TabsTrigger value="by-student" className="gap-1.5"><Users className="w-4 h-4" /> By Student</TabsTrigger>
            </TabsList>

            {/* ===== BY STEP TAB ===== */}
            <TabsContent value="by-step">
              {stepBreakdown.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No steps configured.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-3 pr-4 font-medium">#</th>
                        <th className="pb-3 pr-4 font-medium">Step</th>
                        <th className="pb-3 pr-4 font-medium text-center">
                          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Completed</span>
                        </th>
                        <th className="pb-3 pr-4 font-medium text-center">
                          <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Avg Time</span>
                        </th>
                        <th className="pb-3 pr-4 font-medium text-center">
                          <span className="inline-flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" /> Avg Clicks</span>
                        </th>
                        <th className="pb-3 font-medium text-center">Responses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stepBreakdown.map((row) => (
                        <tr key={row.step.step_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 pr-4 text-slate-400 text-xs font-mono">{row.index + 1}</td>
                          <td className="py-3 pr-4 text-slate-800 font-medium max-w-[200px] truncate">{row.step.title}</td>
                          <td className="py-3 pr-4 text-center">
                            <span className="font-semibold text-slate-900">{row.uniqueCompleted}</span>
                            <span className="text-slate-400">/{students.length}</span>
                          </td>
                          <td className="py-3 pr-4 text-center text-slate-600">{formatDuration(row.avgTimeMs)}</td>
                          <td className="py-3 pr-4 text-center text-slate-600">{row.avgMediaClicks}</td>
                          <td className="py-3 text-center">
                            {row.hasResponses && row.totalResponses > 0 ? (
                              <Sheet>
                                <SheetTrigger
                                  render={
                                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 gap-1" onClick={() => setSelectedStepId(row.step.step_id)}>
                                      <Eye className="w-3.5 h-3.5" /> View ({row.uniqueCompleted})
                                    </Button>
                                  }
                                />
                                <SheetContent className="sm:max-w-lg overflow-y-auto">
                                  <SheetHeader>
                                    <SheetTitle>Responses: {row.step.title}</SheetTitle>
                                  </SheetHeader>
                                  <div className="mt-6 space-y-4">
                                    {Object.entries(row.responsesByStudent).map(([studentId, versions]) => {
                                      const student = students.find(s => s.id === studentId)
                                      const latest = versions[0]
                                      const older = versions.slice(1)
                                      const versionKey = `${row.step.step_id}-${studentId}`
                                      const isVersionExpanded = expandedVersions.has(versionKey)
                                      return (
                                        <div key={studentId} className="border border-slate-200 rounded-lg p-4">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-slate-800 text-sm">{student?.name || 'Unknown'}</span>
                                            <span className="text-xs text-slate-400">{format(new Date(latest.submitted_at), 'HH:mm:ss')}</span>
                                          </div>
                                          {older.length > 0 ? (
                                            <button
                                              onClick={() => {
                                                setExpandedVersions(prev => {
                                                  const next = new Set(prev)
                                                  if (next.has(versionKey)) next.delete(versionKey)
                                                  else next.add(versionKey)
                                                  return next
                                                })
                                              }}
                                              className="w-full text-left"
                                            >
                                              <p className="text-sm text-slate-600 bg-slate-50 rounded p-3 underline decoration-blue-400 decoration-dotted underline-offset-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                {latest.response_value || <em className="text-slate-400">No response</em>}
                                                <span className="text-xs text-blue-500 ml-2">({versions.length} version{versions.length !== 1 ? 's' : ''})</span>
                                              </p>
                                            </button>
                                          ) : (
                                            <p className="text-sm text-slate-600 bg-slate-50 rounded p-3">{latest.response_value || <em className="text-slate-400">No response</em>}</p>
                                          )}
                                          {isVersionExpanded && older.length > 0 && (
                                            <div className="mt-2 pl-3 border-l-2 border-slate-200 space-y-2">
                                              <p className="text-xs text-slate-400 font-medium">Previous versions:</p>
                                              {older.map(v => (
                                                <div key={v.id} className="flex justify-between items-start text-xs">
                                                  <span className="text-slate-500 bg-slate-50 rounded px-2 py-1 flex-1">{v.response_value || '—'}</span>
                                                  <span className="text-slate-400 shrink-0 ml-2">{format(new Date(v.submitted_at), 'HH:mm:ss')}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </SheetContent>
                              </Sheet>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ===== BY STUDENT TAB ===== */}
            <TabsContent value="by-student">
              {studentBreakdown.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">No students have joined yet.</p>
              ) : (
                <div className="space-y-3">
                  {studentBreakdown.map(({ student, completedSteps, totalSteps, completionPct, totalTimeMs, lastStepName, stepDetails }) => {
                    const isExpanded = expandedStudents.has(student.id)
                    return (
                      <div key={student.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        {/* Collapsed Header — always visible */}
                        <button
                          onClick={() => toggleStudent(student.id)}
                          className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-semibold text-sm text-slate-800 truncate">{student.name}</span>
                            <span className="text-xs font-mono text-slate-400 shrink-0">{completedSteps}/{totalSteps}</span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">{completionPct}%</span>
                              <span title="Last completed step" className="max-w-[120px] truncate">{lastStepName}</span>
                              <span title="Total time">{formatDuration(totalTimeMs)}</span>
                            </div>
                            {/* Progress mini-bar */}
                            <div className="w-16 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {/* Expanded Detail — conditionally shown */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-4 pb-3">
                            {/* Mobile metrics row */}
                            <div className="sm:hidden flex gap-4 text-xs text-slate-500 py-2 border-b border-slate-50 mb-2">
                              <span><strong className="text-slate-700">{completionPct}%</strong> complete</span>
                              <span>Last: {lastStepName}</span>
                              <span>{formatDuration(totalTimeMs)}</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100 text-slate-400">
                                    <th className="pb-2 pr-3 text-left font-medium">#</th>
                                    <th className="pb-2 pr-3 text-left font-medium">Step</th>
                                    <th className="pb-2 pr-3 text-center font-medium">Status</th>
                                    <th className="pb-2 pr-3 text-center font-medium">Time</th>
                                    <th className="pb-2 pr-3 text-center font-medium">Clicks</th>
                                    <th className="pb-2 text-left font-medium">Response</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stepDetails.map((sd, idx) => (
                                    <tr key={sd.step.step_id} className="border-b border-slate-50">
                                      <td className="py-2 pr-3 text-slate-400 font-mono">{idx + 1}</td>
                                      <td className="py-2 pr-3 text-slate-700 max-w-[150px] truncate">{sd.step.title}</td>
                                      <td className="py-2 pr-3 text-center">
                                        {sd.completed ? (
                                          <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Completed" />
                                        ) : (
                                          <span className="inline-block w-2 h-2 rounded-full bg-slate-300" title="Not completed" />
                                        )}
                                      </td>
                                      <td className="py-2 pr-3 text-center text-slate-500">{sd.completed ? formatDuration(sd.timeMs) : '—'}</td>
                                      <td className="py-2 pr-3 text-center text-slate-500">{sd.mediaClicks || '—'}</td>
                                      <td className="py-2 text-slate-600 max-w-[200px]">
                                        {sd.responseValue ? (
                                          sd.versionCount > 1 ? (
                                            <button
                                              onClick={() => {
                                                const key = `student-${student.id}-${sd.step.step_id}`
                                                setExpandedVersions(prev => {
                                                  const next = new Set(prev)
                                                  if (next.has(key)) next.delete(key)
                                                  else next.add(key)
                                                  return next
                                                })
                                              }}
                                              className="text-left"
                                            >
                                              <span className="underline decoration-blue-400 decoration-dotted underline-offset-2 cursor-pointer truncate block max-w-[200px]">
                                                {sd.responseValue}
                                              </span>
                                              <span className="text-[10px] text-blue-500">{sd.versionCount} ver.</span>
                                            </button>
                                          ) : (
                                            <span className="truncate block max-w-[200px]">{sd.responseValue}</span>
                                          )
                                        ) : '—'}
                                        {sd.versionCount > 1 && expandedVersions.has(`student-${student.id}-${sd.step.step_id}`) && (
                                          <div className="mt-1 pl-2 border-l-2 border-slate-200 space-y-1">
                                            {sd.allResponses.slice(1).map(v => (
                                              <div key={v.id} className="flex justify-between text-[10px] text-slate-400">
                                                <span className="truncate mr-1">{v.response_value || '—'}</span>
                                                <span className="shrink-0">{format(new Date(v.submitted_at), 'HH:mm')}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
