'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleBookmark(lessonId: string, currentStatus: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('bookmarks')
    .eq('id', user.id)
    .single()
  
  let bookmarks = profile?.bookmarks || []
  
  if (currentStatus) {
    bookmarks = bookmarks.filter((id: string) => id !== lessonId)
  } else {
    if (!bookmarks.includes(lessonId)) {
      bookmarks.push(lessonId)
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ bookmarks })
    .eq('id', user.id)

  if (error) throw new Error(error.message)
    
  revalidatePath(`/dashboard/lesson/${lessonId}`)
  return !currentStatus
}

export async function createSession(lessonId: string, selectedSteps: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Generate a random 6-character short code for students
  const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      lesson_id: lessonId,
      teacher_id: user.id,
      session_code: sessionCode,
      selected_steps_json: selectedSteps,
      status: 'active'
    })
    .select()

  if (error) throw new Error(error.message)

  return data[0].id
}
