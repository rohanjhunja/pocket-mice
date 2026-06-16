import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

interface ProgressHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  isPreview?: boolean;
  lessonId?: string;
  isSimulationWrapper?: boolean;
  simulationId?: string;
  // ── Teacher sync ──
  isTeacher?: boolean;
  isSyncing?: boolean;
  onSyncLearners?: () => void;
}

export function ProgressHeader({
  title,
  currentStep,
  totalSteps,
  isPreview,
  lessonId,
  isSimulationWrapper,
  simulationId,
  isTeacher = false,
  isSyncing = false,
  onSyncLearners,
}: ProgressHeaderProps) {
  // calculate progress percentage (0 to 100)
  const progressPercent =
    totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  const backHref =
    isSimulationWrapper && simulationId
      ? `/dashboard/simulation/${simulationId}`
      : lessonId
      ? `/dashboard/lesson/${lessonId}`
      : "/dashboard";

  const backLabel = isSimulationWrapper
    ? "Return to Simulation Overview"
    : "Back to Lesson Overview";

  return (
    <div className="bg-white px-6 py-3 border-b border-slate-200 z-50 shadow-sm relative">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
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
          {/* Only show step counter for multi-step (non-wrapper) lessons */}
          {!isSimulationWrapper && (
            <span className="text-sm text-slate-500 font-medium">
              Step {currentStep + 1} of {totalSteps}
            </span>
          )}

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

          {isPreview && (
            <Link href={backHref}>
              <Button variant="secondary" size="sm" className="h-8">
                <ArrowLeft className="w-3 h-3 mr-1.5" /> {backLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Hide progress bar for simulation wrappers — there's only one step */}
      {!isSimulationWrapper && (
        <Progress value={progressPercent} className="h-1.5" />
      )}
    </div>
  );
}
