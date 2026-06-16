import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { profileLessonsSimulations } from '@/utils/simProfiling'
import LessonPlayer from '@/components/LessonPlayer'

export default async function PreviewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Fetch the lesson
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lesson) {
    return notFound()
  }

  // Trigger profiling asynchronously to ensure baselines exist
  profileLessonsSimulations(lesson.json_content).catch(console.error);

  const isSimulationWrapper = !!lesson.json_content?.is_simulation_wrapper;

  // For simulation wrappers, find the simulation ID from the simulations table by URL
  let simulationId: string | undefined;
  if (isSimulationWrapper) {
    const simUrl = lesson.json_content?.activities?.[0]?.steps?.[0]?.interactive_or_media?.media_url;
    if (simUrl) {
      const { data: sim } = await supabase
        .from('simulations')
        .select('id')
        .eq('url', simUrl)
        .single();
      simulationId = sim?.id;
    }
  }

  // Create a mock session object out of the lesson
  const mockSession = {
    id: 'preview-session',
    session_code: 'PREVIEW',
    teacher_id: user.id,
    selected_steps_json: lesson.json_content,
    lessons: lesson,
    created_at: new Date().toISOString()
  }

  const mockStudent = {
    id: 'preview-student',
    name: 'Preview Mode',
    session_id: 'preview-session'
  }

  return (
    <LessonPlayer 
      session={mockSession} 
      student={mockStudent} 
      initialResponses={{}}
      resumeStepIndex={0}
      isPreview={true}
      isSimulationWrapper={isSimulationWrapper}
      simulationId={simulationId}
    />
  )
}

