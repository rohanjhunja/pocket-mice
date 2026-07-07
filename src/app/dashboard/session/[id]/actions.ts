'use server'

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function joinAsTeacherAction(sessionId: string, sessionCode: string) {
  const supabase = await createClient()

  // Get current authenticated user (the teacher)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  // Get the teacher's profile full name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const teacherName = profile?.full_name || user.email || 'Teacher'

  // Check if a student record already exists for this teacher in this session
  let { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('session_id', sessionId)
    .eq('name', teacherName)
    .maybeSingle()

  if (!student) {
    const { data: newStudent, error: insertError } = await supabase
      .from('students')
      .insert({
        session_id: sessionId,
        name: teacherName,
      })
      .select()
      .single()

    if (insertError || !newStudent) {
      throw new Error('Failed to register teacher as a student: ' + insertError?.message)
    }
    student = newStudent
  }

  // Set the student cookie for this session
  const cookieStore = await cookies()
  cookieStore.set(`pocket_mice_student_${sessionCode}`, student.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })

  // Redirect to the play page with teacher_join query param
  redirect(`/play/${sessionCode}?teacher_join=true`)
}
