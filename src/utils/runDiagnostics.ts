export type DiagnosticResponsibility = 'user_device' | 'user_network' | 'platform_origin' | 'platform_code' | 'none';

export interface DiagnosticTrace {
  device: { status: 'ok' | 'warning' | 'error', detail: string, root_causes?: string[] };
  network: { status: 'ok' | 'warning' | 'error', detail: string, root_causes?: string[] };
  origin: { status: 'ok' | 'warning' | 'error', detail: string, root_causes?: string[] };
  download: { status: 'ok' | 'delayed' | 'error', actual_ms?: number, expected_ms?: number, detail: string, root_causes?: string[] };
  execution: { status: 'ok' | 'error', detail: string, root_causes?: string[] };
  responsibility: DiagnosticResponsibility;
}

/**
 * Runs a quick canary test to check actual outbound network latency.
 */
async function runCanaryTest(): Promise<{ ms: number | null, success: boolean }> {
  try {
    const start = performance.now();
    // Fetching the site's own favicon as a canary to test DNS & basic egress
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s strict timeout
    
    const res = await fetch('/favicon.ico?_canary=' + Date.now(), { 
      method: 'HEAD', 
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (res.ok) {
      return { ms: Math.round(performance.now() - start), success: true };
    }
    return { ms: null, success: false };
  } catch (e) {
    return { ms: null, success: false };
  }
}

/**
 * Parses navigator.connection if available.
 */
function getNetworkInfo() {
  const nav = navigator as any;
  if (nav.connection) {
    return {
      downlink: nav.connection.downlink as number | undefined, // Mbps
      effectiveType: nav.connection.effectiveType as string | undefined,
      rtt: nav.connection.rtt as number | undefined
    };
  }
  return null;
}

export async function runDiagnostics(
  simUrl: string, 
  actualLoadMs: number | null, 
  dynamicExpectedMs: number | null,
  baselineTtfbMs: number = 50,
  hasJsError: boolean = false
): Promise<DiagnosticTrace> {
  const trace: DiagnosticTrace = {
    device: { status: 'ok', detail: 'Online' },
    network: { status: 'ok', detail: 'Unknown' },
    origin: { status: 'ok', detail: 'Unknown' },
    download: { status: 'ok', detail: 'Unknown' },
    execution: { status: 'ok', detail: 'Unknown' },
    responsibility: 'none'
  };

  // 1. Device Check
  if (!navigator.onLine) {
    trace.device = { 
      status: 'error', 
      detail: 'Device is offline.',
      root_causes: [
        '[Confirmed] Local device has no active internet connection.',
        '[Likely] Disconnected from WiFi or router is down.',
        '[Possible] Cellular dead zone or ISP outage.'
      ]
    };
    trace.responsibility = 'user_device';
    return trace;
  }
  
  const hwConcurrency = navigator.hardwareConcurrency || 'Unknown';
  trace.device.detail = `Online (Cores: ${hwConcurrency})`;

  // 2. Network Check
  const netInfo = getNetworkInfo();
  const downlink = netInfo?.downlink;
  
  if (netInfo) {
    if (netInfo.effectiveType === '2g' || netInfo.effectiveType === 'slow-2g') {
      trace.network = { 
        status: 'error', 
        detail: `Severely throttled (${netInfo.effectiveType})`,
        root_causes: [
          '[Confirmed] Browser is reporting a severely throttled 2G connection.',
          '[Very Likely] Poor physical signal strength.',
          '[Possible] ISP artificial throttling or exhausted data cap.'
        ]
      };
      trace.responsibility = 'user_network';
      return trace; // Hard fail
    }
  }

  const canary = await runCanaryTest();
  if (!canary.success) {
    trace.network = { 
      status: 'error', 
      detail: 'School/Local network blocking connection or extreme timeout.',
      root_causes: [
        '[Very Likely] School firewall or local network is actively blocking outbound connections.',
        '[Likely] Trapped behind a captive portal (e.g. hotel/cafe WiFi login).',
        '[Possible] Complete DNS failure at the ISP level.'
      ]
    };
    trace.responsibility = 'user_network';
    return trace;
  }

  let networkDetail = `Ping: ${canary.ms}ms`;
  if (downlink) {
    networkDetail = `${downlink} Mbps (Expected: 5.0+ Mbps). Ping: ${canary.ms}ms`;
    if (downlink < 2) {
      trace.network.status = 'warning';
      trace.network.detail = `Slow internet. ` + networkDetail;
    } else {
      trace.network.detail = `Good internet. ` + networkDetail;
    }
  } else {
    trace.network.detail = `Speed unknown. ` + networkDetail;
  }

  // 3. Origin Check (Pre-flight)
  if (actualLoadMs === null) {
    try {
      const embedCheck = await fetch(`/api/check-embed?url=${encodeURIComponent(simUrl)}`).then(r => r.json());
      if (!embedCheck.embeddable) {
        trace.origin = { 
          status: 'error', 
          detail: 'Host blocked embedding.',
          root_causes: [
            '[Confirmed] Simulation host server set security headers (X-Frame-Options / CSP) blocking cross-origin iframes.'
          ]
        };
        trace.responsibility = 'platform_origin';
        return trace;
      }
    } catch (e) {
      trace.origin = { 
        status: 'error', 
        detail: 'Failed to verify origin.',
        root_causes: [
          '[Likely] Simulation server (S3/PhET/CODAP) is currently down or unreachable.',
          '[Possible] Simulation file was deleted or moved (404 Error).',
          '[Possible] Strict CORS policies blocked the pre-flight check.'
        ]
      };
    }

    trace.download = { 
      status: 'error', 
      detail: 'Download timed out completely.',
      root_causes: [
        '[Very Likely] Simulation bundle is massively oversized for the current connection.',
        '[Likely] Origin server connection dropped midway through the download.',
        '[Possible] Origin server is hanging and not closing the connection.'
      ]
    };
    trace.responsibility = 'platform_origin';
    return trace;
  }

  // 4. Download Check
  trace.origin.detail = 'HTTP 200 OK'; // If it loaded, origin was fine.
  trace.download.actual_ms = actualLoadMs;
  trace.download.expected_ms = dynamicExpectedMs || undefined;

  if (dynamicExpectedMs) {
    const ratio = actualLoadMs / dynamicExpectedMs;
    const diff = Math.round((actualLoadMs - dynamicExpectedMs) / 1000);
    
    if (ratio > 2.0) {
      trace.download.status = 'error';
      trace.download.detail = `Observed: ${Math.round(actualLoadMs / 1000)}s | Expected: ${Math.round(dynamicExpectedMs / 1000)}s.`;
      trace.download.root_causes = [
        '[Likely] Heavy server load on simulation origin causing slow delivery.',
        `[Possible] Host server took too long to deliver simulation bundle (${diff}s delay).`
      ];
      trace.responsibility = 'platform_origin';
    } else if (ratio > 1.25) {
      trace.download.status = 'delayed';
      trace.download.detail = `Observed: ${Math.round(actualLoadMs / 1000)}s | Expected: ${Math.round(dynamicExpectedMs / 1000)}s.`;
      trace.download.root_causes = [
        '[Likely] Slight network fluctuation or sudden local traffic spike.',
        `[Possible] Minor host delay (${diff}s delay).`
      ];
      if (trace.responsibility === 'none') trace.responsibility = 'platform_origin';
    } else {
      trace.download.detail = `Observed: ${Math.round(actualLoadMs / 1000)}s | Expected: ${Math.round(dynamicExpectedMs / 1000)}s. Loaded within expected time window.`;
    }
  } else {
    trace.download.detail = `Observed: ${Math.round(actualLoadMs / 1000)}s | Expected: Unknown. No baseline available for comparison.`;
  }

  // 5. Execution Check
  if (hasJsError) {
    trace.execution = { 
      status: 'error', 
      detail: 'Fatal Javascript Exception during initialization.',
      root_causes: [
        '[Very Likely] Simulation code contains a fatal bug or syntax error.',
        '[Possible] Browser is too old to support modern Javascript features required by the simulation.',
        '[Possible] Simulation relies on a missing sub-asset (e.g., 404 image or script) that failed to load.'
      ]
    };
    trace.responsibility = 'platform_code';
  } else {
    trace.execution = { status: 'ok', detail: 'Simulation initialized successfully.' };
  }

  // Final fallback for responsibility: If network was warned and download was delayed but ratio was ok? 
  // Ratio handles dynamic expectation, so if ratio is 1.0 but it's slow, it's a user network issue.
  if (trace.responsibility === 'none' && trace.network.status === 'warning') {
    trace.responsibility = 'user_network';
  }

  return trace;
}
