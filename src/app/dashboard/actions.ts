'use server'

import { createClient } from '@/utils/supabase/server'
import { getRole } from '@/utils/getRole'
import { profileLessonsSimulations } from '@/utils/simProfiling'
import { revalidatePath } from 'next/cache'

/** Own lessons only (scoped to current teacher). Used on the main dashboard. */
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
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching lessons:', error)
    return []
  }

  return (data || []).filter((l: any) => !l.json_content?.is_simulation_wrapper)
}


/**
 * All lessons across all teachers — used for the Global Library toggle
 * and the admin dashboard. Joins profiles to surface teacher email.
 */
export async function getAllLessons(searchQuery?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false })

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching all lessons:', error)
    return []
  }

  return (data || []).map((lesson: any) => ({
    ...lesson,
    teacher_email: null, // profiles.email doesn't exist; email lives in auth.users
  }))
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

  // Trigger profiling asynchronously
  profileLessonsSimulations(doc).catch(console.error);

  revalidatePath('/dashboard')
  return data[0]
}

export async function getRecentSessions() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const role = await getRole(supabase, user.id)
  const isAdmin = role === 'admin'

  // Admin: all sessions across all teachers, with teacher email joined.
  // Teacher: own sessions only — eliminates N+1 with embedded student count.
  // Select explicit columns — avoids failures from schema drift or missing migrations.
  // Note: profiles.email doesn't exist (email is in auth.users, not accessible via PostgREST).
  // Admin gets the same columns as teacher for now; teacher_id is available for display.
  const sessionColumns = 'id, lesson_id, teacher_id, session_code, status, created_at, lessons(title), students(count)'

  let query = supabase
    .from('sessions')
    .select(sessionColumns)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('teacher_id', user.id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching recent sessions:', error)
    return []
  }

  return (data || []).map((session: any) => ({
    ...session,
    studentCount: session.students?.[0]?.count ?? 0,
    teacher_email: null, // email not available via profiles table
    profiles: undefined,
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

  // 1. Fetch existing simulations
  const { data: existingSims, error } = await supabase
    .from('simulations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching simulations:', error)
    return []
  }

  // 2. Fetch all lessons to find implicit simulations (ones embedded in lessons but not tracked yet)
  const { data: lessons } = await supabase.from('lessons').select('json_content, teacher_id')
  
  const existingUrls = new Set(existingSims.map(s => s.url))
  const newSimulationsMap = new Map<string, any>()

  if (lessons) {
    lessons.forEach(lesson => {
      // Skip auto-generated simulation wrapper lessons
      if (lesson.json_content?.is_simulation_wrapper) return;
      (lesson.json_content?.activities || []).forEach((act: any) => {
        (act.steps || []).forEach((step: any) => {
          let url = step.interactive_or_media?.media_url;
          const type = step.interactive_or_media?.media_type;
          const title = step.interactive_or_media?.media_title || step.title || 'Untitled Simulation';
          
          if (url && type === 'simulation') {
            if (url.startsWith('http://')) url = url.replace('http://', 'https://');
            if (url.toUpperCase().includes('POCKET%20MOUSE-NATURAL%20SELECTION_V2.HTML')) {
              url = '/Pocket Mouse-Natural Selection_v2.html';
            }
            
            if (!existingUrls.has(url) && !newSimulationsMap.has(url)) {
              newSimulationsMap.set(url, {
                teacher_id: lesson.teacher_id, // attribute to the lesson author
                title: title,
                url: url
              });
            }
          }
        });
      });
    });
  }

  // 3. Auto-upsert missing simulations — ignoreDuplicates prevents future double-inserts
  let allSims = existingSims;
  if (newSimulationsMap.size > 0) {
    const toInsert = Array.from(newSimulationsMap.values());
    const { data: inserted } = await supabase
      .from('simulations')
      .upsert(toInsert, { onConflict: 'url', ignoreDuplicates: true })
      .select();
    if (inserted && inserted.length > 0) {
      allSims = [...existingSims, ...inserted];
    }
  }

  // 4. Deduplicate by URL — handles any duplicates already in the DB
  const seen = new Set<string>();
  return allSims
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter(sim => {
      if (seen.has(sim.url)) return false;
      seen.add(sim.url);
      return true;
    });
}

export async function addSimulationByUrl(url: string, title?: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check if it already exists to avoid duplicates
  const { data: existing } = await supabase
    .from('simulations')
    .select('id, title')
    .eq('url', url)
    .single()

  if (existing) {
    return { id: existing.id, exists: true, title: existing.title }
  }

  // Fetch title if not provided
  let finalTitle = title
  if (!finalTitle) {
    try {
      // In a server action, we can't easily call our own API route via full URL without knowing the host.
      // So we just fetch directly from here.
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LearnTube-Bot/1.0' },
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        const html = await res.text()
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (titleMatch && titleMatch[1]) {
          finalTitle = titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
        }
      }
    } catch (e) {
      console.error('Failed to fetch title for', url, e)
    }
  }

  const insertData = {
    teacher_id: user.id,
    title: finalTitle || url,
    url: url,
  }

  const { data: dbData, error: dbError } = await supabase
    .from('simulations')
    .insert(insertData)
    .select()

  if (dbError) {
    throw new Error(dbError.message)
  }

  revalidatePath('/dashboard')
  return { id: dbData[0].id, exists: false, title: dbData[0].title }
}

export async function createSimulationLesson(simulationId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: sim, error: simError } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', simulationId)
    .single()

  if (simError || !sim) throw new Error('Simulation not found')

  const lessonJson = {
    lesson_title: `Preview: ${sim.title}`,
    lesson_description: 'Auto-generated preview wrapper.',
    estimated_duration_minutes: 15,
    is_simulation_wrapper: true,
    activities: [
      {
        activity_id: 'sim_act_1',
        activity_title: 'Simulation',
        activity_type: 'exploration',
        sequence_order: 1,
        steps: [
          {
            step_id: 'sim_step_1',
            title: sim.title,
            step_type: 'media',
            sequence_order: 1,
            instruction_format: 'text',
            completion_condition: 'next_button',
            interactive_or_media: {
              media_type: 'simulation',
              media_title: sim.title,
              media_url: sim.url,
              embed: true
            }
          }
        ]
      }
    ]
  }

  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .insert({
      teacher_id: user.id,
      title: lessonJson.lesson_title,
      description: lessonJson.lesson_description,
      tags: ['auto-generated', 'simulation-wrapper', 'preview'],
      json_content: lessonJson,
    })
    .select()

  if (lessonError) throw new Error(`Failed to create preview lesson: ${lessonError.message}`)

  return lessonData[0].id
}

export async function createSimulationSession(simulationId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Fetch simulation details
  const { data: sim, error: simError } = await supabase
    .from('simulations')
    .select('*')
    .eq('id', simulationId)
    .single()

  if (simError || !sim) throw new Error('Simulation not found')

  // 2. Create a hidden, single-step lesson
  const lessonJson = {
    lesson_title: `Live Simulation: ${sim.title}`,
    lesson_description: "Automatically generated lesson wrapper for a live simulation assignment.",
    estimated_duration_minutes: 15,
    is_simulation_wrapper: true,
    activities: [
      {
        activity_id: "sim_act_1",
        activity_title: "Simulation",
        activity_type: "exploration",
        sequence_order: 1,
        steps: [
          {
            step_id: "sim_step_1",
            title: sim.title,
            step_type: "media",
            sequence_order: 1,
            instruction_format: "text",
            completion_condition: "next_button",
            interactive_or_media: {
              media_type: "simulation",
              media_title: sim.title,
              media_url: sim.url,
              embed: true
            }
          }
        ]
      }
    ]
  }

  const insertLessonData = {
    teacher_id: user.id,
    title: lessonJson.lesson_title,
    description: lessonJson.lesson_description,
    tags: ["auto-generated", "simulation-wrapper"],
    json_content: lessonJson,
  }

  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .insert(insertLessonData)
    .select()

  if (lessonError) throw new Error(`Failed to wrap simulation: ${lessonError.message}`)

  const newLessonId = lessonData[0].id

  // 3. Create the Session
  const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()
  const insertSessionData = {
    lesson_id: newLessonId,
    teacher_id: user.id,
    session_code: sessionCode,
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert(insertSessionData)
    .select()

  if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`)

  revalidatePath('/dashboard')
  return sessionData[0].id
}

export async function uploadThumbnail(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided')

  const fileName = `thumbnails/${user.id}/${Math.random().toString(36).substring(2)}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`

  const { error: uploadError } = await supabase.storage
    .from('simulations')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage
    .from('simulations')
    .getPublicUrl(fileName)

  return publicUrlData.publicUrl
}
