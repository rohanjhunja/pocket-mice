import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * PATCH /api/sessions/[id]/sync-step
 * Body: { teacher_step_id: string }
 *
 * Updates the session's teacher_step_id, triggering Supabase Realtime
 * to broadcast the change to all subscribed learner clients.
 *
 * Protected: only the authenticated owner of the session may call this.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify the caller is an authenticated teacher
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { teacher_step_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { teacher_step_id } = body
  if (!teacher_step_id) {
    return NextResponse.json({ error: 'teacher_step_id is required' }, { status: 400 })
  }

  // Verify caller owns this session
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('id, teacher_id')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden — you do not own this session' }, { status: 403 })
  }

  // Update the session — this write triggers Supabase Realtime UPDATE event
  const { error: updateError } = await supabase
    .from('sessions')
    .update({ teacher_step_id })
    .eq('id', sessionId)

  if (updateError) {
    console.error('[sync-step] update error', updateError)
    return NextResponse.json({ error: 'Failed to sync step' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, teacher_step_id })
}
