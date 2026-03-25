import { ReactNode } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface InstructionOverlayProps {
  step: any;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  children: ReactNode;
  fallbackUrl?: string | null;
}

export function InstructionOverlay({ step, isMinimized, onToggleMinimize, children, fallbackUrl }: InstructionOverlayProps) {
  // Treat embed-failed as "no media" for layout (centered, full-width)
  const hasMedia = !!step.interactive_or_media && !fallbackUrl;

  // Compute dynamic classes for layout
  let baseClasses = "absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden flex flex-col z-10 bg-white/95 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.15)] border border-white/40 rounded-t-2xl md:rounded-2xl";
  
  if (!hasMedia) {
    baseClasses += " md:right-1/2 md:bottom-1/2 md:translate-x-1/2 md:translate-y-1/2 md:w-[600px] md:max-w-[90vw] bottom-0 right-0 w-full h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-120px)]";
    if (isMinimized) {
      baseClasses += " md:!bottom-6 md:!translate-y-[calc(100%-60px)]";
    }
  } else {
    baseClasses += " bottom-0 right-0 w-full md:w-[400px] md:bottom-6 md:right-6 max-h-[70vh] md:max-h-[calc(100vh-120px)] h-auto";
    if (isMinimized) {
      baseClasses += " translate-y-[calc(100%-60px)] md:translate-y-[calc(100%-72px)]";
    }
  }

  const showCollapse = hasMedia || typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <div className={baseClasses}>
      {/* Panel Header */}
      <div 
        className="flex justify-between items-center py-4 px-5 bg-white/80 border-b border-slate-200 cursor-pointer"
        onClick={onToggleMinimize}
      >
        <h2 className="text-lg font-semibold text-slate-900 m-0">{step.title}</h2>
        {showCollapse && (
          <button className="bg-transparent border-none cursor-pointer text-slate-500 flex items-center justify-center p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors">
            {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        )}
      </div>

      {/* Panel Body */}
      <div className={`p-5 overflow-y-auto flex-1 text-base leading-relaxed ${isMinimized ? 'hidden' : 'block'}`}>
        <div className="mb-5 text-slate-900" dangerouslySetInnerHTML={{ __html: step.instruction_text.replace(/\\n/g, '<br>') }} />
        {fallbackUrl && (
          <div className="mb-5 space-y-2">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors no-underline"
            >
              <ExternalLink className="w-4 h-4" /> Open Resource in New Tab
            </a>
            <p className="text-xs text-slate-400 break-all">{fallbackUrl}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
