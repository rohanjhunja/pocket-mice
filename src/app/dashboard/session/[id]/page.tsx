import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play } from 'lucide-react'
import { CopyableJoinLink } from '@/components/CopyableJoinLink'
import { SessionMetricsLive } from '@/components/SessionMetricsLive'
import { SessionAnalytics } from '@/components/SessionAnalytics'
import { joinAsTeacherAction } from './actions'

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

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Live Session Dashboard</h1>
          <p className="text-lg text-slate-600">Lesson: {session.lessons?.title || (session.selected_steps_json as any)?.lesson_title || 'Unknown Lesson'}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full lg:w-auto">
          <CopyableJoinLink sessionCode={session.session_code} />
          <form action={joinAsTeacherAction.bind(null, sessionId, session.session_code)} className="flex">
            <button 
              type="submit"
              className="bg-white px-6 py-4 rounded-xl border-2 border-slate-200 shadow-sm flex items-center gap-4 hover:border-blue-400 hover:bg-slate-50 transition-colors text-left group h-full cursor-pointer w-full"
            >
              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Play className="text-slate-600 w-6 h-6 group-hover:text-blue-600 transition-colors fill-slate-600 group-hover:fill-blue-600" />
              </div>
              <div>
                <div className="text-xs uppercase font-bold text-slate-500 tracking-wider">Teacher View</div>
                <div className="font-bold text-slate-800 text-lg">View Lesson</div>
              </div>
            </button>
          </form>
        </div>
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

