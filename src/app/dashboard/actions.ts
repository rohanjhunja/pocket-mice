'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getLessons(searchQuery?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false })

  if (searchQuery) {
    // Basic insensitive search on title or description
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching lessons:', error)
    return []
  }

  return data
}

export async function uploadLesson(jsonData: any) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const doc = Array.isArray(jsonData) ? jsonData[0] : jsonData;

  // Apply safe defaults
  doc.activities?.forEach((a: any, ai: number) => {
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
      if (s.learner_response && !s.learner_response.response_type) {
        s.learner_response.response_type = 'text_short'
      }
    })
  })
  let totalSteps = 0
  doc.activities?.forEach((a: any) => { totalSteps += a.steps?.length || 0 })
  doc.total_activity_count = doc.activities?.length || 0
  doc.total_step_count = totalSteps

  const insertData = {
    teacher_id: user.id,
    title: doc.lesson_title || 'Untitled Upload',
    description: doc.lesson_description || doc.lesson_overview || '',
    tags: [],
    json_content: doc,
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert(insertData)
    .select()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
  return data[0]
}

export async function getRecentSessions() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Single query: join student count inline — eliminates N+1 pattern
  const { data, error } = await supabase
    .from('sessions')
    .select('*, lessons(title), students(count)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recent sessions:', error)
    return []
  }

  return (data || []).map((session: any) => ({
    ...session,
    studentCount: session.students?.[0]?.count ?? 0,
  }))
}


export async function deleteLesson(lessonId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
}

export async function uploadSimulation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('file') as File
  const title = formData.get('title') as string
  if (!file) throw new Error('No file provided')

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${Math.random().toString(36).substring(2)}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`

  const { error: uploadError } = await supabase.storage
    .from('simulations')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage
    .from('simulations')
    .getPublicUrl(fileName)

  const insertData = {
    teacher_id: user.id,
    title: title || file.name,
    url: `/api/sim?url=${encodeURIComponent(publicUrlData.publicUrl)}`,
  }

  const { data: dbData, error: dbError } = await supabase
    .from('simulations')
    .insert(insertData)
    .select()

  if (dbError) {
    throw new Error(dbError.message)
  }

  return dbData[0]
}

export async function getSimulations() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('simulations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching simulations:', error)
    return []
  }

  return data
}
