import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CopyableJoinLink } from '@/components/CopyableJoinLink'
import { SessionMetricsLive } from '@/components/SessionMetricsLive'
import { SessionAnalytics } from '@/components/SessionAnalytics'

export default async function SessionDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { id: sessionId } = await params

  // 1. Fetch Session
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('*, lessons(*)')
    .eq('id', sessionId)
    .eq('teacher_id', user.id)
    .single()

  if (sessionErr || !session) return notFound()

  // 2. Fetch full data arrays for analytics
  const [
    { data: studentsData },
    { data: responsesData },
    { data: eventsData }
  ] = await Promise.all([
    supabase.from('students').select('*').eq('session_id', sessionId).order('joined_at'),
    supabase.from('responses').select('*').eq('session_id', sessionId).order('submitted_at'),
    supabase.from('events').select('*').eq('session_id', sessionId).order('created_at'),
  ])

  const studentsList = studentsData || []
  const responsesList = responsesData || []
  const eventsList = eventsData || []

  // 3. Compute KPI metrics
  const studentsStarted = studentsList.length
  const responsesSubmitted = responsesList.length
  
  let expectedSteps = 0
  session.selected_steps_json.activities?.forEach((act: any) => {
    expectedSteps += act.steps?.length || 0
  })
  
  const completionRate = (studentsStarted > 0 && expectedSteps > 0)
    ? Math.round((responsesSubmitted / (studentsStarted * expectedSteps)) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 inline-flex items-center text-sm font-medium mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Live Session Dashboard</h1>
          <p className="text-lg text-slate-600">Lesson: {session.lessons.title}</p>
        </div>
        
        <CopyableJoinLink sessionCode={session.session_code} />
      </div>

      <SessionMetricsLive 
        sessionId={sessionId}
        expectedSteps={expectedSteps}
        initialStudents={studentsStarted}
        initialResponses={responsesSubmitted}
        initialCompletionRate={completionRate}
      />

      <SessionAnalytics
        selectedStepsJson={session.selected_steps_json}
        students={studentsList}
        responses={responsesList}
        events={eventsList}
      />
    </div>
  )
}

