'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function joinSessionAction(sessionId: string, sessionCode: string, studentName: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('students')
    .insert({
      session_id: sessionId,
      name: studentName,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error('Failed to join session. Please try again.')
  }

  // Set a secure http-only cookie to remember the student for this session
  const cookieStore = await cookies()
  cookieStore.set(`pocket_mice_student_${sessionCode}`, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })

  redirect(`/play/${sessionCode}`)
}
