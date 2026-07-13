import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Users, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getActivityColor } from "@/utils/activityColors";

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
  // ── New props ──
  activities?: any[];
  allSteps?: any[];
  onNavigateToStep?: (index: number) => void;
  // ── Tab row props ──
  activeTab?: "interact" | "discuss";
  onTabChange?: (tab: "interact" | "discuss") => void;
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
  activities = [],
  allSteps = [],
  onNavigateToStep,
  activeTab = "interact",
  onTabChange,
}: ProgressHeaderProps) {
  // Find current activity index based on step index
  const currentActivityIndex = useMemo(() => {
    if (!activities) return 0;
    const currentStepObj = allSteps?.[currentStep];
    if (currentStepObj && typeof currentStepObj.activityIndex === 'number') {
      return currentStepObj.activityIndex;
    }
    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      if (currentStep >= act.startIndex && currentStep < act.startIndex + act.stepCount) {
        return i;
      }
    }
    return 0;
  }, [activities, allSteps, currentStep]);

  // calculate progress percentage (0 to 100)
  const progressPercent =
    totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  const backHref =
    isSimulationWrapper && simulationId
      ? `/dashboard/simulation/${simulationId}`
      : lessonId
      ? `/dashboard/lesson/${lessonId}`
      : "/dashboard";

  return (
    <div className="bg-white px-6 pt-3 pb-4 border-b border-slate-200 z-50 shadow-sm relative">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isPreview && (
            <Link href={backHref} className="shrink-0">
              <Button variant="secondary" size="sm" className="h-8 flex items-center">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
            </Link>
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

          {/* Tab row: Interact / Discuss */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => onTabChange?.("interact")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                activeTab === "interact"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Interact
            </button>
            <button
              onClick={() => onTabChange?.("discuss")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                activeTab === "discuss"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Discuss
            </button>
          </div>
        </div>
      </div>

      {!isSimulationWrapper && activities && activities.length > 0 && (
        <div 
          className="flex w-full gap-2 pt-1 overflow-x-auto scrollbar-none pb-0.5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {activities.map((activity, idx) => {
            const color = getActivityColor(idx);
            const isCurrent = currentActivityIndex === idx;
            
            return (
              <div
                key={activity.activity_id || idx}
                onClick={() => onNavigateToStep?.(activity.startIndex)}
                className={`flex items-center justify-between flex-1 min-w-[140px] md:min-w-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 select-none cursor-pointer ${
                  isCurrent
                    ? `${color.bg} ${color.borderActive} ${color.text} shadow-sm ring-1 ring-offset-0 ring-[currentcolor]`
                    : `bg-slate-50/50 border-slate-200 ${color.text} opacity-70 hover:opacity-100 hover:bg-slate-50 hover:border-slate-350`
                }`}
              >
                <span className="truncate pr-1">
                  {activity.activity_title}
                </span>
                
                {/* Dropdown Menu Arrow */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isCurrent
                        ? `hover:bg-black/5 ${color.text}`
                        : "hover:bg-slate-200/50 text-slate-400 hover:text-slate-600"
                    }`}
                    aria-label={`Select step in ${activity.activity_title}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 min-w-[220px] bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                    {activity.steps?.map((step: any) => {
                      const stepIdx = allSteps?.findIndex((s: any) => s.step_id === step.step_id) ?? -1;
                      const isStepCurrent = currentStep === stepIdx;
                      return (
                        <DropdownMenuItem
                          key={step.step_id}
                          className={`cursor-pointer px-3 py-2 text-xs flex items-center justify-between transition-colors focus:bg-slate-50 focus:text-slate-900 ${
                            isStepCurrent
                              ? `${color.text} font-bold bg-slate-50/50`
                              : "text-slate-700 font-medium hover:bg-slate-50/30"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (stepIdx !== -1) {
                              onNavigateToStep?.(stepIdx);
                            }
                          }}
                        >
                          <span className="truncate">{step.title}</span>
                          {isStepCurrent && (
                            <span className={`w-1.5 h-1.5 rounded-full ${color.bgActive}`} />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar positioned absolutely at the bottom edge under the Activity tabs */}
      {!isSimulationWrapper && (
        <Progress value={progressPercent} className="absolute bottom-0 left-0 w-full h-1 rounded-none z-10" />
      )}
    </div>
  );
}
