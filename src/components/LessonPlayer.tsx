"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ProgressHeader } from "./ProgressHeader";
import { MediaBackground } from "./MediaBackground";
import { InstructionOverlay } from "./InstructionOverlay";
import { ResponseForm } from "./ResponseForm";
import { CompletionCard } from "./CompletionCard";
import { submitResponse, trackEvent } from "@/app/play/[code]/actions";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { ResponseSummaryPanel, ResponseType } from "./ResponseSummaryPanel";
import { getActivityColor } from "@/utils/activityColors";

interface ResponseRow {
  id: string;
  student_id: string;
  step_id: string;
  response_value: string;
  submitted_at: string;
}

interface LessonPlayerProps {
  session: any;
  student: any;
  initialResponses: Record<string, string>;
  resumeStepIndex?: number;
  isPreview?: boolean;
  isSimulationWrapper?: boolean;
  simulationId?: string;
  isTeacher?: boolean;
  /** Pre-fetched response rows for the summary panel (initial snapshot) */
  initialResponseRows?: ResponseRow[];
  teacherJoin?: boolean;
}

export default function LessonPlayer({
  session,
  student,
  initialResponses,
  resumeStepIndex = 0,
  isPreview = false,
  isSimulationWrapper = false,
  simulationId,
  isTeacher = false,
  initialResponseRows = [],
  teacherJoin = false,
}: LessonPlayerProps) {
  const [allSteps, setAllSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(resumeStepIndex);
  const [learnerResponses, setLearnerResponses] = useState<Record<string, string>>(initialResponses);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [currentInputValue, setCurrentInputValue] = useState("");
  const [isVideoTheme, setIsVideoTheme] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedEmbedUrl, setFailedEmbedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"interact" | "discuss">("interact");
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});
  const [showAllCards, setShowAllCards] = useState(false);

  // Keep a running list of all response rows for the summary panel
  const [allResponseRows, setAllResponseRows] = useState<ResponseRow[]>(initialResponseRows);

  // ── Response count per step (live) ──────────────────────────────────────
  // Map of step_id → count of unique students who have responded
  const stepResponseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const latestPerStudent: Record<string, Set<string>> = {};
    for (const r of allResponseRows) {
      if (!latestPerStudent[r.step_id]) {
        latestPerStudent[r.step_id] = new Set();
      }
      latestPerStudent[r.step_id].add(r.student_id);
    }
    for (const [stepId, students] of Object.entries(latestPerStudent)) {
      counts[stepId] = students.size;
    }
    return counts;
  }, [allResponseRows]);

  // ── Teacher sync state ───────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // ── Flatten steps ────────────────────────────────────────────────────────
  useEffect(() => {
    const steps: any[] = [];
    if (session.selected_steps_json?.activities) {
      session.selected_steps_json.activities.forEach((activity: any, actIdx: number) => {
        if (activity.steps) {
          activity.steps.forEach((step: any) => {
            steps.push({
              ...step,
              activityIndex: actIdx,
              activityTitle: activity.activity_title,
              stepIndexInFlattened: steps.length,
            });
          });
        }
      });
    }
    setAllSteps(steps);
  }, [session]);

  // ── Compute activities mapping for tabs ─────────────────────────────────
  const activities = useMemo(() => {
    const list: any[] = [];
    if (session.selected_steps_json?.activities) {
      let startIndex = 0;
      session.selected_steps_json.activities.forEach((activity: any, actIdx: number) => {
        const stepCount = activity.steps?.length || 0;
        list.push({
          activity_id: activity.activity_id,
          activity_title: activity.activity_title,
          activityIndex: actIdx,
          startIndex,
          stepCount,
          steps: activity.steps || [],
        });
        startIndex += stepCount;
      });
    }
    return list;
  }, [session]);

  const step = allSteps[currentStepIndex];

  const currentActivityIndex = step?.activityIndex ?? 0;
  const currentActivityTitle = step?.activityTitle || "Activity";

  const activitySteps = useMemo(() => {
    return allSteps.filter((s) => s.activityIndex === currentActivityIndex);
  }, [allSteps, currentActivityIndex]);

  const displayedSteps = useMemo(() => {
    if (showAllCards) return activitySteps;
    return activitySteps.filter((s) => {
      if (!s.learner_response) return false;
      return allResponseRows.some(
        (r) => r.step_id === s.step_id && r.response_value?.trim()
      );
    });
  }, [activitySteps, showAllCards, allResponseRows]);

  // ── Step view tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (allSteps.length > 0) {
      const step = allSteps[currentStepIndex];
      setCurrentInputValue(learnerResponses[step.step_id] || "");
      setIsMinimized(false);
      setFailedEmbedUrl(null);
      if (!isPreview || teacherJoin) {
        trackEvent(student.id, session.id, step.step_id, "step_viewed");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, allSteps.length]);

  // ── Supabase Realtime: response inserts ──────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`lesson-player-responses-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "responses",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const newRow = payload.new as ResponseRow;
          setAllResponseRows((prev) => [...prev, newRow]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, supabase]);

  // ── Supabase Realtime: teacher_step_id changes (learner side) ───────────
  useEffect(() => {
    if (!session?.id || isTeacher || isPreview) return;

    const channel = supabase
      .channel(`lesson-player-session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const newStepId: string | null = (payload.new as any).teacher_step_id;
          if (!newStepId) return;

          setAllSteps((steps) => {
            const idx = steps.findIndex((s) => s.step_id === newStepId);
            if (idx !== -1 && idx !== currentStepIndex) {
              setCurrentStepIndex(idx);
              toast("Your teacher has moved you to a new step", {
                icon: "📍",
                duration: 4000,
              });
            }
            return steps;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, isTeacher, isPreview, supabase]);

  // ── Teacher sync handler ─────────────────────────────────────────────────
  const handleSyncLearners = useCallback(async () => {
    const currentStep = allSteps[currentStepIndex];
    if (!isTeacher || !currentStep) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/sync-step`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_step_id: currentStep.step_id }),
      });
      if (!res.ok) throw new Error("Sync failed");
      toast.success("All learners synced to this step", { duration: 2500 });
    } catch {
      toast.error("Could not sync learners. Please try again.");
    } finally {
      // Show syncing state briefly so teacher gets visual feedback
      setTimeout(() => setIsSyncing(false), 1500);
    }
  }, [isTeacher, allSteps, currentStepIndex, session.id]);

  if (allSteps.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 bg-slate-50">
        Initializing session footprint...
      </div>
    );
  }


  const handleSaveResponse = async () => {
    if (step.learner_response) {
      const val = currentInputValue;
      setLearnerResponses((prev) => ({ ...prev, [step.step_id]: val }));

      try {
        setIsSubmitting(true);
        if (!isPreview || teacherJoin) {
          await submitResponse(student.id, session.id, step.step_id, val);
        }
      } catch {
        toast.error("Failed to save response. Please check connection.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleNext = async () => {
    if (!isPreview || teacherJoin) {
      trackEvent(student.id, session.id, step.step_id, "step_completed");
    }
    await handleSaveResponse();
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setShowCompletion(true);
    }
  };

  const handleBack = async () => {
    if (currentStepIndex > 0) {
      if (!isPreview || teacherJoin) {
        trackEvent(student.id, session.id, step.step_id, "step_completed");
      }
      await handleSaveResponse();
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNavigateToStep = async (index: number) => {
    if (index === currentStepIndex) return;
    if (!isPreview || teacherJoin) {
      trackEvent(student.id, session.id, step.step_id, "step_completed");
    }
    await handleSaveResponse();
    setCurrentStepIndex(index);
  };


  const currentStepResponseCount = stepResponseCounts[step?.step_id] ?? 0;

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${
        isVideoTheme ? "bg-black" : "bg-slate-50"
      }`}
    >
      <ProgressHeader
        title={session.lessons?.title || "Live Lesson"}
        currentStep={currentStepIndex}
        totalSteps={allSteps.length}
        isPreview={isPreview}
        lessonId={session.lessons?.id}
        isSimulationWrapper={isSimulationWrapper}
        simulationId={simulationId}
        isTeacher={isTeacher}
        isSyncing={isSyncing}
        onSyncLearners={handleSyncLearners}
        activities={activities}
        allSteps={allSteps}
        onNavigateToStep={handleNavigateToStep}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 relative overflow-hidden">
        {activeTab === "interact" ? (
          <>
            <MediaBackground
              media={step.interactive_or_media}
              stepId={step.step_id}
              onThemeChange={setIsVideoTheme}
              onMediaInteraction={(eventType) => {
                if (!isPreview || teacherJoin) trackEvent(student.id, session.id, step.step_id, eventType);
              }}
              onEmbedError={(url) => setFailedEmbedUrl(url)}
            />

            {/* For simulation wrappers, suppress the instruction panel entirely */}
            {!isSimulationWrapper && (
              <InstructionOverlay
                step={step}
                isMinimized={isMinimized}
                onToggleMinimize={() => setIsMinimized(!isMinimized)}
                fallbackUrl={failedEmbedUrl}
                sessionId={session.id}
                responseCount={currentStepResponseCount}
                allSteps={allSteps}
                initialResponses={allResponseRows}
              >
                <ResponseForm
                  responseReq={step.learner_response ? {
                    ...step.learner_response,
                    response_required: teacherJoin ? false : step.learner_response.response_required
                  } : null}
                  currentValue={currentInputValue}
                  onChange={setCurrentInputValue}
                  onSubmit={handleNext}
                  onBack={handleBack}
                  canGoBack={currentStepIndex > 0}
                  isLastStep={currentStepIndex === allSteps.length - 1}
                  isSubmitting={isSubmitting}
                  isPreview={isPreview}
                />
              </InstructionOverlay>
            )}

            {showCompletion && !isSimulationWrapper && (
              <CompletionCard isPreview={isPreview} lessonId={session.lessons?.id} />
            )}
          </>
        ) : (
          /* Discuss View */
          <div className="h-full overflow-y-auto bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Class Discussion & Responses</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Viewing answers for <span className="font-semibold text-slate-700">{currentActivityTitle}</span>
                  </p>
                </div>

                {/* Show All Steps Toggle */}
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm self-start md:self-auto select-none">
                  <span className="text-xs font-semibold text-slate-600">Show all steps</span>
                  <button
                    onClick={() => setShowAllCards(prev => !prev)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showAllCards ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                    aria-label="Toggle showing all steps"
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showAllCards ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {displayedSteps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <p className="text-sm font-semibold text-slate-700">No responses yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Toggle &ldquo;Show all steps&rdquo; to see steps that don't have responses yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12 animate-fadeIn">
                  {displayedSteps.map((s) => {
                    const isExpanded = !!expandedQuestions[s.step_id];
                    const qText = s.instruction_text || "";
                    const hasInput = !!s.learner_response;
                    const rType = s.learner_response?.response_type || "text_short";

                    return (
                      <div
                        key={s.step_id}
                        className="flex flex-col bg-white border border-slate-200 rounded-xl pt-4 pb-3 shadow-sm hover:shadow-md transition-shadow h-[350px] max-h-[350px] overflow-hidden"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0 px-4">
                          <h3 className={`text-sm font-bold truncate ${getActivityColor(s.activityIndex ?? 0).text}`}>
                            {s.title}
                          </h3>
                        </div>

                        {/* Question Content */}
                        <div className="text-xs text-slate-600 mt-2 leading-relaxed flex-shrink-0 px-4">
                          <div className={isExpanded ? "" : "line-clamp-3"}>
                            {qText || "No question for this step."}
                          </div>
                          {qText.length > 100 && (
                            <button
                              onClick={() =>
                                setExpandedQuestions((prev) => ({
                                  ...prev,
                                  [s.step_id]: !prev[s.step_id],
                                }))
                              }
                              className="text-blue-600 hover:text-blue-800 font-semibold mt-1 text-[11px] block focus:outline-none"
                            >
                              {isExpanded ? "Show Less" : "Show More"}
                            </button>
                          )}
                        </div>

                        {/* Insight View (Response Summary) */}
                        <div className="flex-1 min-h-0 mt-2 border-t border-slate-100 pt-2 overflow-hidden flex flex-col px-3">
                          {hasInput ? (
                            <div className="flex-1 min-h-0 overflow-y-auto">
                              <ResponseSummaryPanel
                                sessionId={session.id}
                                stepId={s.step_id}
                                responseType={rType as ResponseType}
                                options={s.learner_response?.options}
                                allSteps={allSteps}
                                initialResponses={allResponseRows}
                                onClose={() => {}}
                                autoGenerateSummary={false}
                                isCompact={true}
                              />
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                              <p className="text-xs text-slate-400 text-center font-medium">
                                No learner response required for this step.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
