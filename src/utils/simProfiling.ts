import { createClient } from '@/utils/supabase/server';

function classifySourceType(url: string): string {
  if (url.includes('ct-stem.s3.amazonaws.com')) return 'ct-stem-s3';
  if (url.includes('.supabase.co')) return 'supabase-storage';
  if (url.includes('codap.concord.org')) return 'codap';
  if (url.startsWith('/')) return 'local';
  return 'other';
}

export async function profileSimulationUrl(url: string) {
  // Upgrade HTTP to HTTPS for remote
  let targetUrl = url;
  if (targetUrl.startsWith('http://')) targetUrl = targetUrl.replace('http://', 'https://');
  
  // Resolve local paths if running in production context (approximation for now, 
  // local files are considered near-zero latency anyway)
  if (targetUrl.startsWith('/')) {
    targetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${targetUrl}`;
  }

  // Handle our own proxy urls
  if (targetUrl.includes('/api/sim?url=')) {
    const rawUrl = new URL(targetUrl).searchParams.get('url');
    if (rawUrl) targetUrl = rawUrl;
  }

  const sourceType = classifySourceType(targetUrl);
  
  let ttfbMs = 50; // default assumption
  let contentLengthBytes = 100000; // default 100kb
  let idealLoadMs = 500; 

  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // Perform HEAD request to get TTFB and Content-Length
    const headRes = await fetch(targetUrl, { 
      method: 'HEAD', 
      redirect: 'follow', 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    ttfbMs = Math.round(performance.now() - start);

    if (headRes.ok) {
      const cl = headRes.headers.get('content-length');
      if (cl) contentLengthBytes = parseInt(cl, 10);
    }
    
    // Ideal load estimation logic
    // Assuming effective server bandwidth of 50 Mbps (approx 6 MB/s)
    const effectiveBps = 6 * 1024 * 1024;
    const transferMs = (contentLengthBytes / effectiveBps) * 1000;
    
    // Parse overheads based on known heavy SPA loads
    let parseOverheadMs = 100;
    if (sourceType === 'codap') parseOverheadMs = 800;
    if (sourceType === 'ct-stem-s3') parseOverheadMs = 500;
    
    idealLoadMs = Math.round(ttfbMs + transferMs + parseOverheadMs);
    
  } catch (error) {
    console.error(`Failed to profile simulation ${targetUrl}:`, error);
    // Use conservative defaults if unreachable from Vercel
    idealLoadMs = 1500; 
  }

  // Store in database
  const supabase = await createClient();
  const { error } = await supabase
    .from('sim_baselines')
    .upsert({
      url: url, // store the raw requested URL
      source_type: sourceType,
      content_length_bytes: contentLengthBytes,
      ideal_load_ms: idealLoadMs,
      ttfb_ms: ttfbMs,
      last_probed_at: new Date().toISOString()
    }, { onConflict: 'url' });

  if (error) {
    console.error("Failed to upsert sim baseline:", error);
  }

  return { idealLoadMs, ttfbMs, contentLengthBytes, sourceType };
}

export async function profileLessonsSimulations(jsonContent: any) {
  if (!jsonContent?.activities) return;

  const urlsToProfile = new Set<string>();

  jsonContent.activities.forEach((activity: any) => {
    (activity.steps || []).forEach((step: any) => {
      const m = step.interactive_or_media;
      if (m && m.media_url && (m.media_type === 'simulation' || m.media_type === 'content')) {
        urlsToProfile.add(m.media_url);
      }
    });
  });

  // Profile all found URLs asynchronously
  for (const url of Array.from(urlsToProfile)) {
    // Run them without blocking
    profileSimulationUrl(url).catch(e => console.error("Async profile error:", e));
  }
}
