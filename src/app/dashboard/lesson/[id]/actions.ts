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

export async function updateLesson(lessonId: string, updatedJsonContent: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Recompute totals
  let totalSteps = 0
  updatedJsonContent.activities?.forEach((a: any) => { totalSteps += a.steps?.length || 0 })
  updatedJsonContent.total_activity_count = updatedJsonContent.activities?.length || 0
  updatedJsonContent.total_step_count = totalSteps

  // Recompute sequence_order and apply safe defaults
  updatedJsonContent.activities?.forEach((a: any, ai: number) => {
    a.sequence_order = ai + 1
    if (!a.activity_id) a.activity_id = `act_${ai + 1}`
    if (!a.activity_type) a.activity_type = 'exploration'
    a.steps?.forEach((s: any, si: number) => {
      s.sequence_order = si + 1
      if (!s.step_id) s.step_id = `step_${ai + 1}_${si + 1}`
      if (!s.instruction_format) s.instruction_format = 'text'
      if (!s.completion_condition) {
        s.completion_condition = s.learner_response ? 'response_submitted' : 'next_button'
      }
      // Ensure response has valid type
      if (s.learner_response) {
        if (!s.learner_response.response_type) s.learner_response.response_type = 'text_short'
      }
    })
  })

  const { error } = await supabase
    .from('lessons')
    .update({
      title: updatedJsonContent.lesson_title || 'Untitled',
      description: updatedJsonContent.lesson_description || '',
      json_content: updatedJsonContent,
    })
    .eq('id', lessonId)

  if (error) throw new Error(error.message)


  revalidatePath(`/dashboard/lesson/${lessonId}`)
  revalidatePath('/dashboard')
}

export async function duplicateLesson(lessonId: string, jsonContent: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const newTitle = (jsonContent.lesson_title || 'Untitled') + ' (Copy)'
  const duplicatedJson = { ...jsonContent, lesson_title: newTitle }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      teacher_id: user.id,
      title: newTitle,
      description: jsonContent.lesson_description || '',
      tags: [],
      json_content: duplicatedJson,
    })
    .select()

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  return data[0].id
}
