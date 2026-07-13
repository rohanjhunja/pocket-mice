"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, BarChart2, X } from "lucide-react";
import { ResponseSummaryPanel, ResponseType } from "./ResponseSummaryPanel";
import { highlightSingleQuotes } from "@/utils/textFormatter";
import { getActivityColor } from "@/utils/activityColors";

interface StepDef {
  step_id: string;
  title: string;
  learner_response?: {
    response_type?: string;
    options?: string[];
  } | null;
}

interface ResponseRow {
  id: string;
  student_id: string;
  step_id: string;
  response_value: string;
  submitted_at: string;
}

interface InstructionOverlayProps {
  step: any;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  children: ReactNode;
  fallbackUrl?: string | null;
  // ── New props for response summary ──
  sessionId?: string;
  responseCount?: number;
  allSteps?: StepDef[];
  initialResponses?: ResponseRow[];
}

export function InstructionOverlay({
  step,
  isMinimized,
  onToggleMinimize,
  children,
  fallbackUrl,
  sessionId,
  responseCount = 0,
  allSteps = [],
  initialResponses = [],
}: InstructionOverlayProps) {
  const [showSummary, setShowSummary] = useState(false);

  // Treat embed-failed as "no media" for layout (centered, full-width)
  const hasMedia = !!step.interactive_or_media && !fallbackUrl;
  const hasLearnerInput = !!step.learner_response;

  console.log("InstructionOverlay render:", {
    stepId: step.step_id,
    hasLearnerInput,
    sessionId,
    showSummary,
    isMinimized
  });

  // Normalize response type for the summary panel
  const responseType: ResponseType = (() => {
    const t = step.learner_response?.response_type;
    return (t ?? "text_short") as ResponseType;
  })();

  // Compute dynamic classes for layout
  let baseClasses =
    "absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden flex flex-col z-10 bg-white/95 backdrop-blur-md shadow-[0_0_40px_rgba(0,0,0,0.15)] border border-white/40 rounded-t-2xl md:rounded-2xl";

  if (!hasMedia) {
    baseClasses += ` md:right-1/2 md:bottom-1/2 md:translate-x-1/2 md:translate-y-1/2 md:w-[600px] md:max-w-[90vw] bottom-0 right-0 w-full md:max-h-[calc(100vh-160px)] ${
      isMinimized
        ? "h-[60px] md:h-auto md:!bottom-6 md:!translate-y-[calc(100%-60px)]"
        : showSummary && sessionId
        ? "h-[calc(100vh-110px)] md:h-[600px]"
        : "h-[calc(100vh-110px)] md:h-auto"
    }`;
  } else {
    baseClasses += ` bottom-0 right-0 w-full md:w-[400px] md:bottom-6 md:right-6 md:max-h-[calc(100vh-160px)] ${
      isMinimized
        ? "h-[60px] md:h-auto translate-y-[calc(100%-60px)] md:translate-y-[calc(100%-72px)]"
        : showSummary && sessionId
        ? "h-[70vh] md:h-[600px]"
        : "max-h-[70vh] h-auto"
    }`;
  }

  const showCollapse =
    hasMedia ||
    (typeof window !== "undefined" && window.innerWidth >= 768);

  return (
    <div className={baseClasses}>
      {/* ── Panel Header ── */}
      <div
        className="flex justify-between items-center py-4 px-5 bg-white/80 border-b border-slate-200 cursor-pointer"
        onClick={onToggleMinimize}
      >
        <h2 className={`text-lg font-semibold m-0 flex-1 truncate pr-2 ${getActivityColor(step.activityIndex ?? 0).text}`}>
          {step.title}
        </h2>

        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Chart icon — only shown when this step has learner input */}
          {hasLearnerInput && (
            <button
              onClick={() => setShowSummary((v) => !v)}
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                showSummary
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
              }`}
              aria-label={
                showSummary ? "Hide response summary" : "View response summary"
              }
              title={`${responseCount} ${responseCount === 1 ? "response" : "responses"} submitted`}
            >
              <BarChart2 className="w-4 h-4" />
              {/* Count badge */}
              {responseCount > 0 && !showSummary && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {responseCount > 99 ? "99+" : responseCount}
                </span>
              )}
            </button>
          )}

          {/* Collapse toggle */}
          {showCollapse && (
            <button
              onClick={onToggleMinimize}
              className="bg-transparent border-none cursor-pointer text-slate-500 flex items-center justify-center p-1 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel Body ── */}
      <div
        className={`flex-1 flex flex-col text-base leading-relaxed min-h-0 overflow-hidden ${
          isMinimized ? "hidden" : "flex"
        }`}
      >
        {showSummary && sessionId ? (
          /* ── Response Summary Panel ── */
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Summary header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/40">
              <span className="text-sm font-semibold text-slate-700">
                Session Responses
              </span>
              <button
                onClick={() => setShowSummary(false)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded hover:bg-slate-100"
                aria-label="Back to question"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <ResponseSummaryPanel
                sessionId={sessionId}
                stepId={step.step_id}
                responseType={responseType}
                options={step.learner_response?.options}
                allSteps={allSteps}
                initialResponses={initialResponses}
                onClose={() => setShowSummary(false)}
              />
            </div>
          </div>
        ) : (
          /* ── Normal instruction content ── */
          <div className="p-5 overflow-y-auto flex-1 flex flex-col min-h-0">
            <div
              className="mb-5 text-slate-900 whitespace-pre-wrap"
              style={{ whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{
                __html: highlightSingleQuotes(
                  (step.instruction_text || "").replace(/\\n/g, "\n")
                ),
              }}
            />
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
        )}
      </div>
    </div>
  );
}
