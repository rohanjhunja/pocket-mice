'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, CheckCircle, Clock, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SessionMetricsLiveProps {
  sessionId: string
  expectedSteps: number
  initialStudents: number
  initialResponses: number
  initialCompletionRate: number
}

interface ActivityEvent {
  id: string
  type: 'student_joined' | 'response_submitted'
  label: string
  timestamp: string
}

export function SessionMetricsLive({
  sessionId,
  expectedSteps,
  initialStudents,
  initialResponses,
  initialCompletionRate,
}: SessionMetricsLiveProps) {
  const [students, setStudents] = useState(initialStudents)
  const [responses, setResponses] = useState(initialResponses)
  const [completionRate, setCompletionRate] = useState(initialCompletionRate)
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'students',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setStudents((prev) => {
            const newCount = prev + 1
            setCompletionRate(
              newCount > 0 && expectedSteps > 0
                ? Math.round((responses / (newCount * expectedSteps)) * 100)
                : 0
            )
            return newCount
          })
          const p = payload.new as any
          setActivityFeed((prev) => [
            {
              id: p?.id || crypto.randomUUID(),
              type: 'student_joined' as const,
              label: `${p?.name || 'A student'} joined the session`,
              timestamp: p?.joined_at || new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 50))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setResponses((prev) => {
            const newCount = prev + 1
            setCompletionRate(
              students > 0 && expectedSteps > 0
                ? Math.round((newCount / (students * expectedSteps)) * 100)
                : 0
            )
            return newCount
          })
          const p = payload.new as any
          setActivityFeed((prev) => [
            {
              id: p?.id || crypto.randomUUID(),
              type: 'response_submitted' as const,
              label: `Response submitted for step "${p?.step_id || 'unknown'}"`,
              timestamp: p?.submitted_at || new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 50))
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, expectedSteps])

  return (
    <div className="space-y-6">
      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
        {isConnected ? 'Live — updates appear automatically' : 'Connecting...'}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Students Joined</CardTitle>
            <Users className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{students}</div>
            <p className="text-xs text-slate-500 mt-1">
              {students === 0 ? 'Waiting for students to join...' : `${students} student${students !== 1 ? 's' : ''} active`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Overall Completion</CardTitle>
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{completionRate}%</div>
            <p className="text-xs text-slate-500 mt-1">Based on {expectedSteps} expected steps per student</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-600">Activity Level</CardTitle>
            <Clock className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{responses}</div>
            <p className="text-xs text-slate-500 mt-1">Total responses submitted so far</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Activity Ticker */}
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-slate-500">Live Activity</span>
        </div>
        {activityFeed.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-400 text-center">Waiting for student activity…</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-3 px-4 py-3 min-w-max">
              {activityFeed.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    event.type === 'student_joined' ? 'bg-green-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-slate-700">{event.label}</span>
                  <span className="text-slate-400">{formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
