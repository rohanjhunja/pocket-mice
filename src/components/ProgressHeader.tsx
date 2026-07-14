"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, ChevronRight, Check } from "lucide-react";

interface ProgressHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  isPreview?: boolean;
  lessonId?: string;
  sessionId?: string;
  isSimulationWrapper?: boolean;
  simulationId?: string;
  // ── Teacher sync ──
  isTeacher?: boolean;
  isSyncing?: boolean;
  onSyncLearners?: () => void;
  // ── Discussion button props ──
  isDiscussionStep?: boolean;
  isLastStep?: boolean;
  onNext?: () => void;
}

export function ProgressHeader({
  title,
  currentStep,
  totalSteps,
  isPreview,
  lessonId,
  sessionId,
  isSimulationWrapper,
  simulationId,
  isTeacher = false,
  isSyncing = false,
  onSyncLearners,
  isDiscussionStep = false,
  isLastStep = false,
  onNext,
}: ProgressHeaderProps) {
  const router = useRouter();

  // calculate progress percentage (0 to 100)
  const progressPercent =
    totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  const backHref =
    sessionId && sessionId !== 'preview-session'
      ? `/dashboard/session/${sessionId}`
      : isSimulationWrapper && simulationId
      ? `/dashboard/simulation/${simulationId}`
      : lessonId
      ? `/dashboard/lesson/${lessonId}`
      : "/dashboard";

  return (
    <div className="bg-white px-6 py-3 border-b border-slate-200 z-50 shadow-sm relative shrink-0">
      <div className="flex justify-between items-center h-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isPreview && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 flex items-center shrink-0"
              onClick={() => router.push(backHref)}
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
          )}
          <h1 className="font-semibold text-base text-slate-900 truncate">{title}</h1>
          {isPreview && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-wider text-[10px] font-bold shrink-0"
            >
              Preview Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Teacher sync button */}
          {isTeacher && onSyncLearners && (
            <button
              onClick={onSyncLearners}
              disabled={isSyncing}
              className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                isSyncing
                  ? "border-green-300 bg-green-50 text-green-700 cursor-default"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
              }`}
              title="Sync all learners to this step"
              aria-label="Sync learners to current step"
            >
              <Users
                className={`w-4 h-4 transition-transform ${
                  isSyncing ? "animate-pulse" : "group-hover:scale-110"
                }`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Syncing…" : "Sync"}
              </span>
              {/* Tooltip on hover */}
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Pull all learners here
              </span>
            </button>
          )}

          {/* Next Activity / Complete button visible only on Discuss screen */}
          {isDiscussionStep && onNext && (
            <Button
              onClick={onNext}
              className={`font-semibold shadow-sm transition-all flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs ${
                isLastStep
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <span>{isLastStep ? "Complete Lesson" : "Next Activity"}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar positioned absolutely at the bottom edge under the Activity tabs */}
      {!isSimulationWrapper && (
        <Progress value={progressPercent} className="absolute bottom-0 left-0 w-full h-1 rounded-none z-10" />
      )}
    </div>
  );
}
