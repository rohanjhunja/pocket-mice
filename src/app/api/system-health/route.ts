import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic'; // Prevent caching so we get real latency

export async function GET() {
  const start = performance.now();
  let dbLatencyMs: number | null = null;
  let status: 'operational' | 'degraded' | 'outage' = 'operational';
  let detail = '';

  try {
    const supabase = await createClient();
    
    // Measure DB query latency
    const dbStart = performance.now();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    dbLatencyMs = Math.round(performance.now() - dbStart);

    if (error) {
      status = 'outage';
      detail = 'Database query failed.';
    } else if (dbLatencyMs > 1000) {
      status = 'degraded';
      detail = 'Database latency is extremely high.';
    } else {
      detail = 'All systems operational.';
    }
  } catch (err: any) {
    status = 'outage';
    detail = err.message || 'Failed to connect to database.';
  }

  const totalLatencyMs = Math.round(performance.now() - start);
  
  if (status === 'operational' && totalLatencyMs > 1500) {
    status = 'degraded';
    detail = 'API latency is extremely high.';
  }

  return NextResponse.json(
    {
      status,
      detail,
      apiLatencyMs: totalLatencyMs,
      dbLatencyMs,
      timestamp: new Date().toISOString(),
    },
    { 
      status: status === 'outage' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
