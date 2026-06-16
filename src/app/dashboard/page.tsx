import { createClient } from '@/utils/supabase/server'
import { getRole } from '@/utils/getRole'
import { getLessons, getRecentSessions, getSimulations } from './actions'
import { LessonDashboardArea } from '@/components/LessonDashboardArea'
import { RecentSessionsArea } from '@/components/RecentSessionsArea'
import { SimulationsDashboardArea } from '@/components/SimulationsDashboardArea'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user ? await getRole(supabase, user.id) : 'teacher'
  const isAdmin = role === 'admin'

  const [lessons, recentSessions, simulationsRaw, { data: checks }] = await Promise.all([
    getLessons(),
    getRecentSessions(),
    getSimulations(),
    supabase.from('sim_health_checks').select('url, status, load_time_ms, dynamic_expected_ms').order('created_at', { ascending: false })
  ])

  // Attach health status to simulations
  const safeChecks = checks || [];
  const simulations = simulationsRaw.map(sim => {
    const simChecks = safeChecks.filter(c => c.url === sim.url).slice(0, 10);
    let totalActual = 0;
    let totalExpected = 0;
    let failures = 0;

    simChecks.forEach(check => {
      const expected = check.dynamic_expected_ms || 1000;
      totalExpected += expected;
      if (check.status === 'timeout' || check.status === 'error') {
        failures++;
        totalActual += (expected * 3);
      } else {
        totalActual += check.load_time_ms;
      }
    });

    const avgRatio = totalExpected > 0 ? (totalActual / totalExpected) : 1.0;
    let healthStatus = 'Healthy';
    let healthColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    if (simChecks.length === 0) {
      healthStatus = 'Healthy';
      healthColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      simChecks.push({ status: 'success', load_time_ms: 1000 } as any); // Synthetic for ratio math below if needed
    } else if (avgRatio > 2.0 || failures >= 5) {
      healthStatus = 'Unhealthy';
      healthColor = 'bg-red-100 text-red-800 border-red-200';
    } else if (avgRatio > 1.25 || failures >= 3) {
      healthStatus = 'Degraded';
      healthColor = 'bg-amber-100 text-amber-800 border-amber-200';
    }

    return {
      ...sim,
      healthStatus,
      healthColor,
      runsCount: simChecks.length
    }
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">
          {isAdmin ? 'Welcome, Admin!' : 'Welcome Back!'}
        </h2>
        <p className="text-slate-600 text-sm">
          You are authenticated as: <span className="font-medium text-slate-900">{user?.email}</span>
        </p>
      </div>

      {recentSessions.length > 0 && (
        <RecentSessionsArea sessions={recentSessions} isAdmin={isAdmin} />
      )}
      
      <SimulationsDashboardArea simulations={simulations} />

      <div>
        <h3 className="text-xl font-bold mb-6 text-slate-800">
          {isAdmin ? 'All Lessons' : 'Your App Lessons'}
        </h3>
        <LessonDashboardArea
          initialLessons={lessons}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? ''}
        />
      </div>
    </div>
  )
}
