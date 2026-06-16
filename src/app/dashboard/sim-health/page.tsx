import { createClient } from '@/utils/supabase/server';
import { getRole } from '@/utils/getRole';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Activity, Clock, ShieldAlert, Globe, ServerCrash } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SimHealthDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const role = await getRole(supabase, user.id);
  if (role !== 'admin') {
    redirect('/dashboard');
  }

  // 1. Fetch baselines
  const { data: baselines, error: baselinesError } = await supabase
    .from('sim_baselines')
    .select('*')
    .order('last_probed_at', { ascending: false });

  // 2. Fetch health checks
  const { data: checks, error: checksError } = await supabase
    .from('sim_health_checks')
    .select('*')
    .order('created_at', { ascending: false });

  // 3. Fetch lessons to map URLs back to lesson titles
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title, json_content');

  const safeBaselines = baselines || [];
  const safeChecks = checks || [];
  const safeLessons = lessons || [];

  // Map URLs to Lesson Titles and find all unique simulation URLs
  const urlToLessons: Record<string, { id: string, title: string }[]> = {};
  const allSimUrls = new Set<string>();

  safeLessons.forEach(lesson => {
    (lesson.json_content?.activities || []).forEach((act: any) => {
      (act.steps || []).forEach((step: any) => {
        let url = step.interactive_or_media?.media_url;
        const type = step.interactive_or_media?.media_type;
        
        if (url && type === 'simulation') {
          if (url.startsWith('http://')) url = url.replace('http://', 'https://');
          if (url.toUpperCase().includes('POCKET%20MOUSE-NATURAL%20SELECTION_V2.HTML')) {
            url = '/Pocket Mouse-Natural Selection_v2.html';
          }
          
          allSimUrls.add(url);
          if (!urlToLessons[url]) urlToLessons[url] = [];
          if (!urlToLessons[url].find(l => l.id === lesson.id)) {
            urlToLessons[url].push({ id: lesson.id, title: lesson.title });
          }
        }
      });
    });
  });

  // Also include any URLs that have baselines but might be orphaned
  safeBaselines.forEach(b => allSimUrls.add(b.url));

  // Aggregate health status for each unique simulation URL
  const aggregatedStats = Array.from(allSimUrls).map((url, index) => {
    const baseline = safeBaselines.find(b => b.url === url) || {
      id: `stub-${index}`,
      url: url,
      ideal_load_ms: 1000,
      ttfb_ms: 50,
      source_type: 'Unknown (Not Profiled)'
    };

    const baselineChecks = safeChecks.filter(c => c.url === url).slice(0, 10);
    
    let totalActual = 0;
    let totalExpected = 0;
    let failures = 0;
    const breakdown = { user_network: 0, user_device: 0, platform_origin: 0, platform_code: 0 };

    baselineChecks.forEach(check => {
      const expected = check.dynamic_expected_ms || baseline.ideal_load_ms;
      totalExpected += expected;
      
      if (check.status === 'timeout' || check.status === 'error') {
        failures++;
        totalActual += (expected * 3); // Penalty
      } else {
        totalActual += check.load_time_ms;
      }
      
      // Track responsibility for delays or errors
      if (check.diagnostics?.responsibility && check.diagnostics.responsibility !== 'none') {
        const resp = check.diagnostics.responsibility as keyof typeof breakdown;
        if (breakdown[resp] !== undefined) {
          breakdown[resp]++;
        }
      }
    });

    const avgRatio = totalExpected > 0 ? (totalActual / totalExpected) : 1.0;
    let healthStatus = 'Healthy';
    let color = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    if (baselineChecks.length === 0) {
      healthStatus = 'Healthy';
      color = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    } else if (avgRatio > 2.0 || failures >= 5) {
      healthStatus = 'Unhealthy';
      color = 'bg-red-100 text-red-800 border-red-200';
    } else if (avgRatio > 1.25 || failures >= 3) {
      healthStatus = 'Degraded';
      color = 'bg-amber-100 text-amber-800 border-amber-200';
    }

    return {
      id: baseline.id || url,
      url: url,
      source_type: baseline.source_type,
      ideal_load_ms: baseline.ideal_load_ms,
      ttfb_ms: baseline.ttfb_ms,
      healthStatus,
      color,
      avgRatio,
      failures,
      breakdown,
      recentChecksCount: baselineChecks.length,
      parentLessons: urlToLessons[url] || []
    };
  });

  const healthyCount = aggregatedStats.filter(s => s.healthStatus === 'Healthy').length;
  const degradedCount = aggregatedStats.filter(s => s.healthStatus === 'Degraded').length;
  const unhealthyCount = aggregatedStats.filter(s => s.healthStatus === 'Unhealthy').length;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-violet-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Simulation Health Monitor</h2>
          <p className="text-slate-500 text-sm">Aggregate performance over the last 10 runs across all students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-slate-900">{aggregatedStats.length}</div>
            <p className="text-sm font-medium text-slate-500">Tracked Simulations</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-emerald-700">{healthyCount}</div>
            <p className="text-sm font-medium text-emerald-600">Healthy</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-100">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-amber-700">{degradedCount}</div>
            <p className="text-sm font-medium text-amber-600">Degraded</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50/50 border-red-100">
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-red-700">{unhealthyCount}</div>
            <p className="text-sm font-medium text-red-600">Unhealthy</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Status (Last 10)</th>
                <th className="px-6 py-4">Simulation & Parent Lessons</th>
                <th className="px-6 py-4">Source Type</th>
                <th className="px-6 py-4">Baseline (Ideal)</th>
                <th className="px-6 py-4">Avg Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aggregatedStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No simulation baselines recorded yet.
                  </td>
                </tr>
              ) : aggregatedStats.map(stat => (
                <tr key={stat.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`${stat.color} capitalize mb-2`}>
                      {stat.healthStatus}
                    </Badge>
                    <div className="text-xs text-slate-500 space-y-1">
                      {stat.breakdown.user_network > 0 && <div>📡 Student Network: {stat.breakdown.user_network}</div>}
                      {stat.breakdown.user_device > 0 && <div>💻 Student Device: {stat.breakdown.user_device}</div>}
                      {stat.breakdown.platform_origin > 0 && <div className="text-red-500">🌍 Platform Origin: {stat.breakdown.platform_origin}</div>}
                      {stat.breakdown.platform_code > 0 && <div className="text-red-500">🐛 Sim Code: {stat.breakdown.platform_code}</div>}
                      {stat.recentChecksCount > 0 && (Object.values(stat.breakdown) as number[]).reduce((a, b) => a + b, 0) === 0 && <div>No recent issues</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-md">
                    <div className="font-mono text-xs text-slate-600 break-all mb-2 bg-slate-100 p-2 rounded">
                      {stat.url}
                    </div>
                    {stat.parentLessons.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {stat.parentLessons.map((l: { id: string, title: string }) => (
                          <Link key={l.id} href={`/dashboard/lesson/${l.id}`} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
                            {l.title}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Orphaned (No active lessons)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-slate-400" />
                      {stat.source_type}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {stat.ideal_load_ms}ms
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">TTFB: {stat.ttfb_ms}ms</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-mono font-medium ${stat.avgRatio > 1.25 ? (stat.avgRatio > 2.0 ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                      {stat.avgRatio === 1.0 && stat.recentChecksCount === 0 ? '-' : `${stat.avgRatio.toFixed(2)}x`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
