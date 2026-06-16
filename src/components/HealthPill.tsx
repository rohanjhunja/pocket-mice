'use client';

import { useState } from 'react';
import { Loader2, ServerCrash, Wifi, ShieldAlert, Laptop, Activity } from 'lucide-react';
import { DiagnosticTrace } from '@/utils/runDiagnostics';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface HealthPillProps {
  url: string;
  loadStatus: 'checking' | 'loaded' | 'failed' | 'timeout';
  trace: DiagnosticTrace | null;
  aggregateData?: any;
}

export function HealthPill({ url, loadStatus, trace, aggregateData }: HealthPillProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine current run health color based on trace or loadStatus
  let color = 'bg-slate-200 text-slate-500';
  let dotColor = 'bg-slate-400';
  let text = 'Checking...';

  if (loadStatus === 'checking') {
    text = 'Loading...';
  } else if (loadStatus === 'failed' || loadStatus === 'timeout') {
    if (trace?.responsibility === 'user_network' || trace?.responsibility === 'user_device') {
      color = 'bg-amber-50 text-amber-700 border border-amber-200';
      dotColor = 'bg-amber-500';
      text = 'Network Issue';
    } else {
      color = 'bg-red-50 text-red-700 border border-red-200';
      dotColor = 'bg-red-500';
      text = 'Failed';
    }
  } else if (loadStatus === 'loaded' && trace) {
    if (trace.download.status === 'ok' && trace.execution.status === 'ok') {
      color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      dotColor = 'bg-emerald-500';
      text = 'Good';
    } else if (trace.responsibility === 'user_network') {
      color = 'bg-amber-50 text-amber-700 border border-amber-200';
      dotColor = 'bg-amber-500';
      text = 'Slow Internet';
    } else if (trace.download.status === 'delayed') {
      color = 'bg-amber-50 text-amber-700 border border-amber-200';
      dotColor = 'bg-amber-500';
      text = 'Slow';
    } else {
      color = 'bg-red-50 text-red-700 border border-red-200';
      dotColor = 'bg-red-500';
      text = 'Poor';
    }
  } else if (aggregateData) {
    // Fallback to aggregate data if no current trace is available (e.g., Lesson Overview)
    if (aggregateData.status === 'Healthy') {
      color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      dotColor = 'bg-emerald-500';
      text = 'Healthy';
    } else if (aggregateData.status === 'Degraded') {
      color = 'bg-amber-50 text-amber-700 border border-amber-200';
      dotColor = 'bg-amber-500';
      text = 'Degraded';
    } else if (aggregateData.status === 'Unhealthy') {
      color = 'bg-red-50 text-red-700 border border-red-200';
      dotColor = 'bg-red-500';
      text = 'Unhealthy';
    } else {
      text = 'No Data';
    }
  }

  const renderIcon = (status: string) => {
    if (status === 'ok') return <span className="text-emerald-500">✅</span>;
    if (status === 'warning' || status === 'delayed') return <span className="text-amber-500">⚠️</span>;
    return <span className="text-red-500">❌</span>;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger 
        className={`absolute top-4 right-4 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-sm text-xs font-medium transition-all duration-300 opacity-90 hover:opacity-100 cursor-pointer ${color}`} 
      >
        {loadStatus === 'checking' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
        )}
        {text}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Diagnostic Trace
            </h4>
            <p className="text-xs text-slate-500 mt-1">Real-time analysis of the current simulation run.</p>
          </div>

          {!trace && !aggregateData ? (
            <div className="text-sm text-slate-500 italic py-4 text-center">
              Waiting for diagnostics to complete...
            </div>
          ) : trace ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Laptop className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 flex justify-between">
                      Your Device {renderIcon(trace.device.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                    {trace.device.detail}
                    {trace.device.root_causes && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          {trace.device.root_causes.map((cause, i) => <li key={i}>{cause}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Wifi className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 flex justify-between">
                      Your Network {renderIcon(trace.network.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                    {trace.network.detail}
                    {trace.network.root_causes && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          {trace.network.root_causes.map((cause, i) => <li key={i}>{cause}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <ServerCrash className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 flex justify-between">
                      Our System {renderIcon(trace.origin.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                    {trace.origin.detail}
                    {trace.origin.root_causes && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          {trace.origin.root_causes.map((cause, i) => <li key={i}>{cause}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <ShieldAlert className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800 flex justify-between">
                      Simulation Download {renderIcon(trace.download.status)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                    {trace.download.detail}
                    {trace.download.root_causes && (
                      <div className="mt-1.5 text-[10px] text-slate-500">
                        <strong className="text-slate-600 block mb-0.5">Likely Causes:</strong>
                        <ul className="list-disc pl-3 space-y-0.5">
                          {trace.download.root_causes.map((cause, i) => <li key={i}>{cause}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              </div>

              {aggregateData && aggregateData.checks?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2 text-sm">
                    10-Run Summary
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      aggregateData.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' :
                      aggregateData.status === 'Unhealthy' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {aggregateData.status}
                    </span>
                  </h4>
                  <div className="text-xs text-slate-500 space-y-1">
                    {(() => {
                      const breakdown = { user_network: 0, user_device: 0, platform_origin: 0, platform_code: 0 };
                      aggregateData.checks.forEach((check: any) => {
                        if (check.diagnostics?.responsibility && check.diagnostics.responsibility !== 'none') {
                          const r = check.diagnostics.responsibility as keyof typeof breakdown;
                          if (breakdown[r] !== undefined) breakdown[r]++;
                        }
                      });
                      
                      const hasIssues = Object.values(breakdown).reduce((a, b) => a + b, 0) > 0;
                      
                      if (!hasIssues) return <div>No consistent issues detected recently.</div>;
                      
                      return (
                        <>
                          {breakdown.user_network > 0 && <div>📡 Student Network: {breakdown.user_network} times</div>}
                          {breakdown.user_device > 0 && <div>💻 Student Device: {breakdown.user_device} times</div>}
                          {breakdown.platform_origin > 0 && <div className="text-red-500">🌍 Platform Origin: {breakdown.platform_origin} times</div>}
                          {breakdown.platform_code > 0 && <div className="text-red-500">🐛 Sim Code: {breakdown.platform_code} times</div>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {!trace && aggregateData && (
            <div className="space-y-4">
              <div className="mt-2">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2 text-sm">
                  10-Run Summary
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    aggregateData.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' :
                    aggregateData.status === 'Unhealthy' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {aggregateData.status}
                  </span>
                </h4>
                <div className="text-xs text-slate-500 space-y-1">
                  {(() => {
                    const breakdown = { user_network: 0, user_device: 0, platform_origin: 0, platform_code: 0 };
                    (aggregateData.checks || []).forEach((check: any) => {
                      if (check.diagnostics?.responsibility && check.diagnostics.responsibility !== 'none') {
                        const r = check.diagnostics.responsibility as keyof typeof breakdown;
                        if (breakdown[r] !== undefined) breakdown[r]++;
                      }
                    });
                    
                    const hasIssues = Object.values(breakdown).reduce((a, b) => a + b, 0) > 0;
                    
                    if (!hasIssues) return <div>No consistent issues detected recently.</div>;
                    
                    return (
                      <>
                        {breakdown.user_network > 0 && <div>📡 Student Network: {breakdown.user_network} times</div>}
                        {breakdown.user_device > 0 && <div>💻 Student Device: {breakdown.user_device} times</div>}
                        {breakdown.platform_origin > 0 && <div className="text-red-500">🌍 Platform Origin: {breakdown.platform_origin} times</div>}
                        {breakdown.platform_code > 0 && <div className="text-red-500">🐛 Sim Code: {breakdown.platform_code} times</div>}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
