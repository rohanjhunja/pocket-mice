'use server'

import { createClient } from '@/utils/supabase/server'

export async function submitResponse(studentId: string, sessionId: string, stepId: string, responseValue: string) {
  const supabase = await createClient()

  // Always insert a new row — each submission is a version
  const { error } = await supabase
    .from('responses')
    .insert({
      student_id: studentId,
      session_id: sessionId,
      step_id: stepId,
      response_value: responseValue
    })

  if (error) {
    console.error("Error inserting response", error)
    throw new Error("Failed to save response")
  }
}

export async function trackEvent(studentId: string, sessionId: string, stepId: string, eventType: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('events')
    .insert({
      student_id: studentId,
      session_id: sessionId,
      step_id: stepId,
      event_type: eventType
    })

  if (error) {
    console.error("Error tracking event", error)
    // Don't throw — event tracking is best-effort, shouldn't block UX
  }
}
