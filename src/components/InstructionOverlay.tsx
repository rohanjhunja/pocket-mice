import { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface InstructionOverlayProps {
  step: any;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  children: ReactNode; // Response form goes here
}

export function InstructionOverlay({ step, isMinimized, onToggleMinimize, children }: InstructionOverlayProps) {
  const hasMedia = !!step.interactive_or_media;

  // Compute dynamic classes for layout
  // Centered state (no media) vs Floating (media present)
  let baseClasses = "absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden flex flex-col z-10 bg-white/95 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.15)] border border-white/40 rounded-t-2xl md:rounded-2xl";
  
  if (!hasMedia) {
    // Centered overlay, fill mobile completely, wider on desktop
    baseClasses += " md:right-1/2 md:bottom-1/2 md:translate-x-1/2 md:translate-y-1/2 md:w-[600px] md:max-w-[90vw] bottom-0 right-0 w-full h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-120px)]";
    // Also drop it down if minimized on desktop (we hide collapse button on mobile centered)
    if (isMinimized) {
      baseClasses += " md:!bottom-6 md:!translate-y-[calc(100%-60px)]";
    }
  } else {
    // Floating overlay (bottom right)
    baseClasses += " bottom-0 right-0 w-full md:w-[400px] md:bottom-6 md:right-6 max-h-[70vh] md:max-h-[calc(100vh-120px)] h-auto";
    if (isMinimized) {
      baseClasses += " translate-y-[calc(100%-60px)] md:translate-y-[calc(100%-72px)]";
    }
  }

  // Hide collapse button logic: hide on mobile if there is no media
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
      {/* Don't render content if minimized to prevent focus/tab issues */}
      <div className={`p-5 overflow-y-auto flex-1 text-base leading-relaxed ${isMinimized ? 'hidden' : 'block'}`}>
        <div className="mb-5 text-slate-900" dangerouslySetInnerHTML={{ __html: step.instruction_text.replace(/\n/g, '<br>') }} />
        {children}
      </div>
    </div>
  );
}
