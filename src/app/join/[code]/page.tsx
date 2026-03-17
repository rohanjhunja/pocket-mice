import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { JoinForm } from './JoinForm'

export default async function JoinSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, lessons(title, description)')
    .eq('session_code', code)
    .single()

  if (error || !session) {
    return notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 p-8 text-center text-white">
            <h1 className="text-2xl font-bold mb-2">{session.lessons.title}</h1>
            <p className="text-blue-100 text-sm">Join this live session</p>
          </div>
          <div className="p-8">
            <JoinForm sessionId={session.id} sessionCode={code} />
          </div>
        </div>
      </div>
    </div>
  )
}
