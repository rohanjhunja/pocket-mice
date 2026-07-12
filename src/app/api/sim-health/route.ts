import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, load_time_ms, dynamic_expected_ms, status, failure_reason, diagnostics, bandwidth_class } = body;

    if (!url || load_time_ms === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Infer rough region from timezone or just IP (Vercel headers)
    const region = request.headers.get('x-vercel-ip-city') || 'unknown';

    const supabase = await createClient();

    // Ensure baseline exists first, otherwise insert a dummy or trigger profile
    const { data: baseline } = await supabase
      .from('sim_baselines')
      .select('id')
      .eq('url', url)
      .single();

    if (!baseline) {
      const { error: upsertError } = await supabase.from('sim_baselines').upsert({
         url: url,
         source_type: 'unknown',
         ideal_load_ms: 1000,
         ttfb_ms: 50,
         last_probed_at: new Date().toISOString()
      }, { onConflict: 'url' });
      
      if (upsertError) {
        console.error("[SIM_HEALTH] Failed to upsert baseline:", upsertError);
      }
    }

    const serializedPayload = JSON.stringify({
      failure_reason: failure_reason || null,
      diagnostics: diagnostics || null,
      dynamic_expected_ms: dynamic_expected_ms || null
    });

    const { error } = await supabase
      .from('sim_health_checks')
      .insert({
        url,
        load_time_ms,
        status,
        failure_reason: serializedPayload,
        region,
        bandwidth_class
      });

    if (error) {
      console.error("Error inserting health check:", error);
      return NextResponse.json({ error: "Failed to log health" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Get baseline
  const { data: baseline, error: bError } = await supabase
    .from('sim_baselines')
    .select('*')
    .eq('url', url)
    .single();

  if (bError || !baseline) {
    return NextResponse.json({ 
      status: 'Unknown', 
      ideal_load_ms: 1000,
      content_length_bytes: 100000,
      ttfb_ms: 50,
      source_type: 'unknown',
      avg_ratio: 1.0, 
      error: "No baseline found" 
    });
  }

  // 2. Get last 10 checks
  const { data: rawChecks, error: cError } = await supabase
    .from('sim_health_checks')
    .select('*')
    .eq('url', url)
    .order('created_at', { ascending: false })
    .limit(10);

  if (cError || !rawChecks || rawChecks.length === 0) {
    return NextResponse.json({
      status: 'Healthy',
      ideal_load_ms: baseline.ideal_load_ms,
      content_length_bytes: baseline.content_length_bytes,
      ttfb_ms: baseline.ttfb_ms,
      source_type: baseline.source_type,
      avg_ratio: 1.0,
      checks: []
    });
  }

  // Deserialize failure_reason, diagnostics, dynamic_expected_ms
  const checks = rawChecks.map(check => {
    let failure_reason = check.failure_reason;
    let diagnostics = null;
    let dynamic_expected_ms = null;
    if (check.failure_reason && check.failure_reason.startsWith('{')) {
      try {
        const payload = JSON.parse(check.failure_reason);
        failure_reason = payload.failure_reason;
        diagnostics = payload.diagnostics;
        dynamic_expected_ms = payload.dynamic_expected_ms;
      } catch (e) {}
    }
    return {
      ...check,
      failure_reason,
      diagnostics,
      dynamic_expected_ms
    };
  });

  // Calculate moving average ratio using dynamic expected ms if available, else ideal
  let totalActual = 0;
  let totalExpected = 0;
  let failures = 0;

  checks.forEach(check => {
    const expected = check.dynamic_expected_ms || baseline.ideal_load_ms;
    totalExpected += expected;
    
    if (check.status === 'timeout' || check.status === 'error') {
      failures++;
      // Penalize failures heavily in the average
      totalActual += (expected * 3);
    } else {
      totalActual += check.load_time_ms;
    }
  });

  const avgRatio = totalActual / totalExpected;

  let healthStatus = 'Healthy';
  if (avgRatio > 2.0 || failures >= 5) {
    healthStatus = 'Unhealthy';
  } else if (avgRatio > 1.25 || failures >= 3) {
    healthStatus = 'Degraded';
  }

  return NextResponse.json({
    status: healthStatus,
    ideal_load_ms: baseline.ideal_load_ms,
    content_length_bytes: baseline.content_length_bytes,
    ttfb_ms: baseline.ttfb_ms,
    source_type: baseline.source_type,
    avg_ratio: avgRatio,
    failures,
    checks
  });
}
