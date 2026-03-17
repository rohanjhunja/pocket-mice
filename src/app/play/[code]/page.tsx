import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LessonPlayer from '@/components/LessonPlayer'

export default async function PlaySessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  // 1. Fetch Session to ensure it exists
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, lessons(*)')
    .eq('session_code', code)
    .single()

  if (sessionError || !session) {
    return notFound()
  }

  // 2. Read Student Auth Cookie
  const cookieStore = await cookies()
  const studentId = cookieStore.get(`pocket_mice_student_${code}`)?.value

  if (!studentId) {
    redirect(`/join/${code}`)
  }

  // 3. Verify Student exists in this session
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('session_id', session.id)
    .single()

  if (studentError || !student) {
    redirect(`/join/${code}`)
  }

  // 4. Fetch existing responses (ordered by time) for resume + pre-fill
  const { data: previousResponses } = await supabase
    .from('responses')
    .select('*')
    .eq('student_id', student.id)
    .eq('session_id', session.id)
    .order('submitted_at', { ascending: false })

  // Build latest response per step (most recent wins)
  const initialResponses: Record<string, string> = {}
  const answeredStepIds = new Set<string>()
  if (previousResponses) {
    previousResponses.forEach(r => {
      if (!initialResponses[r.step_id]) {
        initialResponses[r.step_id] = r.response_value
      }
      answeredStepIds.add(r.step_id)
    })
  }

  // 5. Compute resume index — first unanswered step
  let resumeStepIndex = 0
  const allSteps: { step_id: string }[] = []
  session.selected_steps_json?.activities?.forEach((act: any) => {
    act.steps?.forEach((step: any) => allSteps.push(step))
  })
  for (let i = 0; i < allSteps.length; i++) {
    if (!answeredStepIds.has(allSteps[i].step_id)) {
      resumeStepIndex = i
      break
    }
    // If all steps answered, go to last step
    if (i === allSteps.length - 1) {
      resumeStepIndex = i
    }
  }

  return (
    <LessonPlayer 
      session={session} 
      student={student} 
      initialResponses={initialResponses}
      resumeStepIndex={resumeStepIndex}
    />
  )
}
