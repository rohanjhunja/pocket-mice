'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Activity, Database, Server, Wifi } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SystemHealth {
  status: 'operational' | 'degraded' | 'outage';
  detail: string;
  apiLatencyMs: number | null;
  dbLatencyMs: number | null;
  timestamp: string;
}

export function PlatformHealthPill() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const start = performance.now();
      const res = await fetch('/api/system-health');
      const data = await res.json();
      
      // Calculate full round-trip (client -> vercel -> supabase -> vercel -> client)
      const fullLatency = Math.round(performance.now() - start);
      
      if (!res.ok && !data.status) {
        setHealth({
          status: 'outage',
          detail: 'Failed to reach API endpoint.',
          apiLatencyMs: null,
          dbLatencyMs: null,
          timestamp: new Date().toISOString()
        });
      } else {
        // Override API latency with full client round-trip to be more honest
        setHealth({
          ...data,
          apiLatencyMs: fullLatency
        });
      }
    } catch (e) {
      setHealth({
        status: 'outage',
        detail: !navigator.onLine ? 'Your device is offline.' : 'Network error reaching platform.',
        apiLatencyMs: null,
        dbLatencyMs: null,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Re-check when window regains focus to keep it fresh without polling constantly
    const handleFocus = () => checkHealth();
    window.addEventListener('focus', handleFocus);
    
    // Also re-check every 3 minutes just in case
    const interval = setInterval(checkHealth, 3 * 60 * 1000);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkHealth]);

  let color = 'bg-slate-100 text-slate-500 border-slate-200';
  let dotColor = 'bg-slate-400';
  let text = 'Checking System...';

  if (!isLoading && health) {
    if (health.status === 'operational') {
      color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      text = 'Platform Operational';
    } else if (health.status === 'degraded') {
      color = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      text = 'Degraded Performance';
    } else {
      color = 'bg-red-50 text-red-700 border-red-200';
      dotColor = 'bg-red-500';
      text = 'Platform Outage';
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger 
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm text-xs font-medium transition-all duration-300 opacity-90 hover:opacity-100 cursor-pointer ${color}`} 
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${dotColor} ${health?.status === 'operational' ? '' : 'animate-pulse'}`} />
        )}
        {text}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end" sideOffset={8}>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Platform Status
            </h4>
            <p className="text-xs text-slate-500 mt-1">{health?.detail || 'Waiting for diagnostics...'}</p>
          </div>

          {health && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Wifi className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">Your Connection</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Observed: {navigator.onLine ? 'Online' : 'Offline'} | Expected: Online
                    {!navigator.onLine && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>[Confirmed] Local device has no active internet connection.</li>
                          <li>[Likely] Disconnected from WiFi or router is down.</li>
                          <li>[Possible] ISP outage or cellular dead zone.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Server className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800 flex justify-between">
                    API Edge
                    {health.apiLatencyMs && (
                      <span className={health.apiLatencyMs > 1000 ? 'text-amber-500' : 'text-emerald-500'}>
                        {health.apiLatencyMs}ms
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {health.apiLatencyMs ? `Observed: ${health.apiLatencyMs}ms | Expected: < 1000ms` : 'Pocket Mice Server'}
                    {health.apiLatencyMs && health.apiLatencyMs > 1000 && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>[Likely] Vercel edge node congestion or high traffic.</li>
                          <li>[Possible] ISP routing issue increasing physical distance to AWS/Vercel.</li>
                          <li>[Unlikely] Platform infrastructure struggling under load.</li>
                        </ul>
                      </div>
                    )}
                    {!health.apiLatencyMs && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>[Very Likely] Pocket Mice Vercel deployment crashed or is unresponsive.</li>
                          <li>[Possible] Vercel API major infrastructure outage.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Database className="w-4 h-4 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800 flex justify-between">
                    Database
                    {health.dbLatencyMs && (
                      <span className={health.dbLatencyMs > 500 ? 'text-amber-500' : 'text-emerald-500'}>
                        {health.dbLatencyMs}ms
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {health.dbLatencyMs ? `Observed: ${health.dbLatencyMs}ms | Expected: < 500ms` : 'Supabase Infrastructure'}
                    {health.dbLatencyMs && health.dbLatencyMs > 500 && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>[Likely] Supabase connection pool exhausted due to high traffic.</li>
                          <li>[Possible] A complex database query is hanging.</li>
                          <li>[Unlikely] Supabase region network congestion.</li>
                        </ul>
                      </div>
                    )}
                    {!health.dbLatencyMs && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          <li>[Very Likely] Database credentials revoked or expired.</li>
                          <li>[Possible] Supabase major infrastructure outage.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="pt-2 text-[10px] text-slate-400 text-right">
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
