import { createClient } from '@/utils/supabase/server'
import { getLessons, getRecentSessions } from './actions'
import { LessonDashboardArea } from '@/components/LessonDashboardArea'
import { RecentSessionsArea } from '@/components/RecentSessionsArea'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [lessons, recentSessions] = await Promise.all([
    getLessons(),
    getRecentSessions()
  ])

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Welcome Back!</h2>
        <p className="text-slate-600 text-sm">
          You are successfully authenticated as: <span className="font-medium text-slate-900">{user?.email}</span>
        </p>
      </div>

      {recentSessions.length > 0 && <RecentSessionsArea sessions={recentSessions} />}
      
      <div>
        <h3 className="text-xl font-bold mb-6 text-slate-800">Your App Lessons</h3>
        <LessonDashboardArea initialLessons={lessons} />
      </div>
    </div>
  )
}
