const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We need a minimal version of the profiler since we're running this as a standalone script outside Next.js
function classifySourceType(url) {
  if (url.includes('ct-stem.s3.amazonaws.com')) return 'ct-stem-s3';
  if (url.includes('.supabase.co')) return 'supabase-storage';
  if (url.includes('codap.concord.org')) return 'codap';
  if (url.startsWith('/')) return 'local';
  return 'other';
}

async function profileSimulationUrl(supabase, url) {
  let targetUrl = url;
  if (targetUrl.startsWith('http://')) targetUrl = targetUrl.replace('http://', 'https://');
  if (targetUrl.startsWith('/')) return; // skip local for backfill

  if (targetUrl.includes('/api/sim?url=')) {
    const rawUrl = new URL(targetUrl, 'http://localhost').searchParams.get('url');
    if (rawUrl) targetUrl = rawUrl;
  }

  const sourceType = classifySourceType(targetUrl);
  let ttfbMs = 50;
  let contentLengthBytes = 100000;
  let idealLoadMs = 500;

  try {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
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
    
    const effectiveBps = 6 * 1024 * 1024;
    const transferMs = (contentLengthBytes / effectiveBps) * 1000;
    
    let parseOverheadMs = 100;
    if (sourceType === 'codap') parseOverheadMs = 800;
    if (sourceType === 'ct-stem-s3') parseOverheadMs = 500;
    
    idealLoadMs = Math.round(ttfbMs + transferMs + parseOverheadMs);
  } catch (error) {
    console.error(`Failed to profile ${targetUrl}:`, error.message);
    idealLoadMs = 1500; 
  }

  const { error } = await supabase
    .from('sim_baselines')
    .upsert({
      url: url,
      source_type: sourceType,
      content_length_bytes: contentLengthBytes,
      ideal_load_ms: idealLoadMs,
      ttfb_ms: ttfbMs,
      last_probed_at: new Date().toISOString()
    }, { onConflict: 'url' });

  if (error) {
    console.error("Failed to upsert sim baseline:", error);
  } else {
    console.log(`✓ Profiled ${url.substring(0, 50)}... -> Ideal: ${idealLoadMs}ms`);
  }
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars in .env.local");
    return;
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Sign in as admin to see all lessons (assuming RLS is enabled)
  console.log("Signing in as admin...");
  const { data: auth, error: authError } = await sb.auth.signInWithPassword({ 
    email: 'admin@pocketmice.edu', 
    password: 'admin' 
  });

  if (authError) {
    console.warn("Admin sign-in failed. Continuing as anon (may see 0 lessons if RLS is on).", authError.message);
  } else {
    console.log("Admin sign-in successful.");
  }

  console.log("Fetching all lessons...");
  const { data: lessons, error } = await sb.from('lessons').select('id, title, json_content');
  if (error) {
    console.error("Error fetching lessons:", error);
    return;
  }

  const urlsToProfile = new Set();

  lessons.forEach(lesson => {
    (lesson.json_content?.activities || []).forEach(activity => {
      (activity.steps || []).forEach(step => {
        const m = step.interactive_or_media;
        if (m && m.media_url && (m.media_type === 'simulation' || m.media_type === 'content')) {
          urlsToProfile.add(m.media_url);
        }
      });
    });
  });

  const urls = Array.from(urlsToProfile);
  console.log(`Found ${urls.length} unique simulations to profile.`);

  for (const url of urls) {
    await profileSimulationUrl(sb, url);
  }

  console.log("Backfill complete!");
}

run();
