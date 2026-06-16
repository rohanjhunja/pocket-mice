import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { profileLessonsSimulations } from '@/utils/simProfiling'
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

  // Trigger profiling asynchronously to ensure baselines exist
  if (session.lessons?.json_content) {
    profileLessonsSimulations(session.lessons.json_content).catch(console.error);
  }

  // 2. Detect if the caller is the teacher (authenticated Supabase user)
  const { data: { user } } = await supabase.auth.getUser()
  const isTeacher = !!(user && user.id === session.teacher_id)

  // 3. Read Student Auth Cookie (for learner mode)
  const cookieStore = await cookies()
  const studentId = cookieStore.get(`pocket_mice_student_${code}`)?.value

  // If the user is neither the teacher NOR a recognised learner, redirect to join
  if (!studentId && !isTeacher) {
    redirect(`/join/${code}`)
  }

  // 4. Verify / load Student record
  let student: any = null
  if (studentId) {
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .eq('session_id', session.id)
      .single()

    if (studentError || !studentData) {
      // Cookie stale — redirect to join unless teacher
      if (!isTeacher) redirect(`/join/${code}`)
    } else {
      student = studentData
    }
  }

  // For teacher viewing without a student cookie, create a virtual placeholder
  if (!student && isTeacher) {
    student = { id: user!.id, name: 'Teacher', session_id: session.id }
  }

  // 5. Fetch this student's responses for resume + pre-fill
  const { data: previousResponses } = student.id !== user?.id
    ? await supabase
        .from('responses')
        .select('*')
        .eq('student_id', student.id)
        .eq('session_id', session.id)
        .order('submitted_at', { ascending: false })
    : { data: [] }

  // Build latest response per step (most recent wins)
  const initialResponses: Record<string, string> = {}
  const answeredStepIds = new Set<string>()
  if (previousResponses) {
    previousResponses.forEach((r: any) => {
      if (!initialResponses[r.step_id]) {
        initialResponses[r.step_id] = r.response_value
      }
      answeredStepIds.add(r.step_id)
    })
  }

  // 6. Compute resume index — first unanswered step
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
    if (i === allSteps.length - 1) {
      resumeStepIndex = i
    }
  }

  // 7. Fetch all session responses for the summary panel (initial snapshot)
  //    For preview mode: also fetch responses from all other sessions of this lesson
  let initialResponseRows: any[] = []

  if (isTeacher || isTeacher === false) {
    // Always fetch live session responses for the summary panel
    const { data: sessionResponses } = await supabase
      .from('responses')
      .select('id, student_id, step_id, response_value, submitted_at')
      .eq('session_id', session.id)
      .order('submitted_at', { ascending: true })

    initialResponseRows = sessionResponses ?? []

    // Preview mode: augment with historical responses from all other sessions of this lesson
    if (isTeacher && session.lessons?.id) {
      const { data: otherSessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('lesson_id', session.lessons.id)
        .neq('id', session.id)

      if (otherSessions && otherSessions.length > 0) {
        const otherSessionIds = otherSessions.map((s: any) => s.id)
        const { data: historicalResponses } = await supabase
          .from('responses')
          .select('id, student_id, step_id, response_value, submitted_at')
          .in('session_id', otherSessionIds)
          .order('submitted_at', { ascending: true })

        if (historicalResponses) {
          // Namespace historical student IDs so they don't collide with live ones
          const namespaced = historicalResponses.map((r: any) => ({
            ...r,
            student_id: `historical:${r.student_id}`,
          }))
          initialResponseRows = [...initialResponseRows, ...namespaced]
        }
      }
    }
  }

  return (
    <LessonPlayer
      session={session}
      student={student}
      initialResponses={initialResponses}
      resumeStepIndex={resumeStepIndex}
      isPreview={isTeacher}
      isTeacher={isTeacher}
      initialResponseRows={initialResponseRows}
    />
  )
}
