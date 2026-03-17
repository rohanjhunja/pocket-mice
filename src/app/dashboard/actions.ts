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
    .eq('teacher_id', user.id)
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

  const insertData = {
    teacher_id: user.id,
    title: doc.lesson_title || 'Untitled Upload',
    description: doc.lesson_overview || '',
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

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*, lessons(title)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching recent sessions:', error)
    return []
  }

  // Get student count for each session
  const sessionsWithCounts = await Promise.all(sessions.map(async (session) => {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      
    return {
      ...session,
      studentCount: count || 0
    }
  }))

  return sessionsWithCounts
}
