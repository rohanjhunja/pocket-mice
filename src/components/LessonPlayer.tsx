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
import { Play, Video, Cpu, MessageSquare, Sparkles } from "lucide-react";

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

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function StepThumbnailPreview({ 
  step, 
  activityColor, 
  patternType 
}: { 
  step: any; 
  activityColor: any; 
  patternType: "strokes" | "dots" | "blank"; 
}) {
  const media = step.interactive_or_media;
  const hasMedia = !!media;

  const renderMedia = () => {
    if (!media) return null;

    let patternStyle: React.CSSProperties = {};
    if (patternType === "strokes") {
      patternStyle = {
        backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 10px)"
      };
    } else if (patternType === "dots") {
      patternStyle = {
        backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1.5px, transparent 1.5px)",
        backgroundSize: "6px 6px"
      };
    }

    const watermarkOverlay = patternType !== "blank" && (
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-80 z-10" 
        style={patternStyle} 
      />
    );

    if (media.thumbnail_url) {
      return (
        <div className="relative w-full h-full bg-white select-none pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.thumbnail_url}
            alt=""
            className="w-full h-full object-contain object-left pointer-events-none animate-fadeIn"
          />
          {watermarkOverlay}
        </div>
      );
    }

    if (media.media_type === "image") {
      return (
        <div className="w-full h-full flex items-center justify-center p-0.5 bg-white select-none pointer-events-none relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.media_url}
            alt=""
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
          {watermarkOverlay}
        </div>
      );
    } else if (media.media_type === "video") {
      const ytId = getYoutubeId(media.media_url);
      if (ytId) {
        return (
          <div className="relative w-full h-full bg-slate-900 select-none pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover opacity-70"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="w-3 h-3 text-white drop-shadow-sm fill-white" />
            </div>
            {watermarkOverlay}
          </div>
        );
      }
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center text-white gap-0.5 select-none pointer-events-none relative ${activityColor.bgActive}`}>
          <Video className="w-3.5 h-3.5 text-white/90" />
          <span className="text-[5px] font-bold text-white/80 uppercase tracking-wider">Video</span>
          {watermarkOverlay}
        </div>
      );
    } else if (media.media_type === "simulation" || media.media_type === "content") {
      return (
        <div className={`w-full h-full flex flex-col items-center justify-center text-white gap-0.5 relative overflow-hidden select-none pointer-events-none ${activityColor.bgActive}`}>
          <div className="absolute inset-1 border border-white/20 rounded flex flex-col items-center justify-center bg-black/10">
            <Cpu className="w-3 h-3 text-white/90 animate-pulse" />
            <span className="text-[4px] font-bold text-white/80 uppercase tracking-widest mt-0.5">SIM</span>
          </div>
          {watermarkOverlay}
        </div>
      );
    }
    return (
      <div className={`w-full h-full flex items-center justify-center text-white text-[6px] select-none pointer-events-none relative ${activityColor.bgActive}`}>
        <span>Media</span>
        {watermarkOverlay}
      </div>
    );
  };

  const renderTextAndForm = (isNarrow: boolean) => {
    const text = step.instruction_text || "";
    const response = step.learner_response;

    return (
      <div className={`h-full flex flex-col justify-between bg-white overflow-hidden p-0.5 select-none pointer-events-none ${isNarrow ? 'w-[30%] border-l border-slate-100' : 'w-full'}`}>
        <div className="flex-1 overflow-hidden">
          <p className="text-[4px] leading-[6px] text-slate-500 font-medium line-clamp-4 break-all">
            {isNarrow ? text.substring(0, 20) : text}
          </p>
        </div>
        
        {response && (
          <div className="mt-0.5 border-t border-slate-150 pt-0.5 flex flex-col gap-0.25">
            {isNarrow ? (
              <div className="w-full h-1.5 bg-indigo-50 border border-indigo-100 rounded flex items-center justify-center">
                <span className="text-[3.5px] text-indigo-500 font-bold leading-none">?</span>
              </div>
            ) : response.response_type === "dropdown" ? (
              <div className="w-full h-2 border border-slate-200 rounded px-1 flex items-center justify-between bg-slate-50">
                <span className="text-[4px] text-slate-400 font-medium">Select...</span>
                <span className="text-[3px] text-slate-400">▼</span>
              </div>
            ) : response.response_type === "choice" || response.response_type === "multiple_choice" ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full border border-slate-350" />
                  <div className="w-8 h-1 bg-slate-200 rounded" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full border border-slate-350" />
                  <div className="w-8 h-1 bg-slate-200 rounded" />
                </div>
              </div>
            ) : (
              <div className="w-full h-2 border border-slate-200 rounded p-0.5 bg-slate-50 flex items-center">
                <span className="text-[4px] text-slate-300">Type response...</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (hasMedia) {
    return (
      <div className="w-full h-full flex flex-row">
        {/* Left Column: Media takes 70% */}
        <div className="w-[70%] h-full overflow-hidden relative shrink-0">
          {renderMedia()}
        </div>
        {/* Right Column: Text takes 30% */}
        {renderTextAndForm(true)}
      </div>
    );
  }

  return renderTextAndForm(false);
}

function DiscussionThumbnailPreview({ activityColor }: { activityColor: any }) {
  return (
    <div className={`relative w-full h-full select-none pointer-events-none overflow-hidden flex items-center justify-center ${activityColor.bgActive}`}>
      {/* Subtle radial pattern for premium texture */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1.2px,transparent_1.2px)] [background-size:6px_6px]" />

      {/* Centered White AI Icon */}
      <div className="relative z-10 flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-white drop-shadow-sm fill-white/10" />
      </div>
    </div>
  );
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
  const [showAllCards, setShowAllCards] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Keep a running list of all response rows for the summary panel
  const [allResponseRows, setAllResponseRows] = useState<ResponseRow[]>(initialResponseRows);

  // ── Response count per step (live) ──────────────────────────────────────
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

// ── Identify common media resources for watermarks ──────────────────────
const mediaResourcePatterns = useMemo(() => {
  const counts: Record<string, number> = {};
  const commonUrls: string[] = [];
  
  allSteps.forEach((s) => {
    const url = s.interactive_or_media?.media_url;
    if (url) {
      counts[url] = (counts[url] || 0) + 1;
    }
  });

  Object.entries(counts).forEach(([url, count]) => {
    if (count > 1) {
      commonUrls.push(url);
    }
  });

  const patterns: Record<string, "strokes" | "dots" | "blank"> = {};
  commonUrls.forEach((url, index) => {
    const types: ("strokes" | "dots")[] = ["strokes", "dots"];
    patterns[url] = types[index % types.length];
  });

  return patterns;
}, [allSteps]);

  // ── Teacher sync state ───────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // ── Flatten steps (Adding sequence Discussion steps) ────────────────────
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
            });
          });
          // Append virtual Discussion step
          steps.push({
            step_id: `discuss-${activity.activity_id || actIdx}`,
            title: "Class Discussion",
            isDiscussionStep: true,
            activityIndex: actIdx,
            activityTitle: activity.activity_title,
          });
        }
      });
      // Set accurate flattened indices
      steps.forEach((s, idx) => {
        s.stepIndexInFlattened = idx;
      });
    }
    setAllSteps(steps);
  }, [session]);

  // ── Compute activities mapping ──────────────────────────────────────────
  const activities = useMemo(() => {
    const list: any[] = [];
    if (session.selected_steps_json?.activities) {
      let startIndex = 0;
      session.selected_steps_json.activities.forEach((activity: any, actIdx: number) => {
        const baseStepCount = activity.steps?.length || 0;
        // Include the virtual Discussion step in the count
        const stepCount = baseStepCount > 0 ? baseStepCount + 1 : 0;
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
    return allSteps.filter((s) => s.activityIndex === currentActivityIndex && !s.isDiscussionStep);
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
      if (!step.isDiscussionStep && (!isPreview || teacherJoin)) {
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
    if (!step.isDiscussionStep && (!isPreview || teacherJoin)) {
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
      if (!step.isDiscussionStep && (!isPreview || teacherJoin)) {
        trackEvent(student.id, session.id, step.step_id, "step_completed");
      }
      await handleSaveResponse();
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNavigateToStep = async (index: number) => {
    if (index === currentStepIndex) return;
    if (!step.isDiscussionStep && (!isPreview || teacherJoin)) {
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
        sessionId={session.id}
        isSimulationWrapper={isSimulationWrapper}
        simulationId={simulationId}
        isTeacher={isTeacher}
        isSyncing={isSyncing}
        onSyncLearners={handleSyncLearners}
        isDiscussionStep={step?.isDiscussionStep}
        isLastStep={currentStepIndex === allSteps.length - 1}
        onNext={handleNext}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left vertical preview bar */}
        {!isSimulationWrapper && (
          <div className="w-[10%] min-w-[130px] max-w-[200px] bg-slate-100 border-r border-slate-200 flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-2 border-b border-slate-200 bg-white flex flex-col gap-0.5 flex-shrink-0">
              <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">Lesson Steps</h2>
              <span className="text-[8px] text-slate-400 font-semibold uppercase">
                {allSteps.length} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-2 custom-scrollbar">
              {activities.map((activity, actIdx) => {
                const color = getActivityColor(actIdx);
                const stepsInActivity = allSteps.filter(s => s.activityIndex === actIdx);

                return (
                  <div
                    key={activity.activity_id || actIdx}
                    className={`p-1.5 rounded-lg border ${color.bg} ${color.border} flex flex-col gap-1.5 shadow-sm transition-all`}
                  >
                    <div className={`font-bold text-[8px] uppercase tracking-wider ${color.text} truncate px-0.5`} title={activity.activity_title}>
                      {activity.activity_title}
                    </div>

                    <div className="space-y-1.5">
                      {stepsInActivity.map((s) => {
                        const isActive = currentStepIndex === s.stepIndexInFlattened;
                        return (
                          <div
                            key={s.step_id}
                            onClick={() => handleNavigateToStep(s.stepIndexInFlattened)}
                            className={`cursor-pointer group flex flex-col gap-0.5 p-1 rounded-md transition-all duration-200 ${
                              isActive
                                ? "bg-white shadow ring-2 ring-indigo-500"
                                : "hover:bg-white/50"
                            }`}
                          >
                            <div className={`relative aspect-video rounded overflow-hidden border transition-colors ${
                              isActive ? "border-indigo-400" : "border-slate-200/50 group-hover:border-slate-350"
                            }`}>
                              {s.isDiscussionStep ? (
                                <DiscussionThumbnailPreview activityColor={color} />
                              ) : (
                                <StepThumbnailPreview 
                                  step={s} 
                                  activityColor={color}
                                  patternType={s.interactive_or_media?.media_url ? (mediaResourcePatterns[s.interactive_or_media.media_url] || "blank") : "blank"}
                                />
                              )}
                              
                              {/* Response Count Badge */}
                              {!s.isDiscussionStep && s.learner_response && (
                                <div className={`absolute top-0 right-0 z-20 min-w-[18px] h-[18px] px-1 rounded-bl-md flex items-center justify-center text-[8px] font-bold text-white shadow-sm ${color.bgActive}`}>
                                  {stepResponseCounts[s.step_id] ?? 0}
                                </div>
                              )}
                            </div>
                            <div className={`text-[8px] font-bold truncate px-0.5 transition-colors ${
                              isActive ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-800"
                            }`} title={s.title}>
                              {s.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right main area */}
        <main className="flex-1 relative overflow-hidden h-full">
          {!step?.isDiscussionStep ? (
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
                  enableLearnerInsights={isTeacher || !!session.selected_steps_json?.enable_learner_insights}
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
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-12 animate-fadeIn">
                      {displayedSteps.map((s) => {
                        const qText = s.instruction_text || "";
                        const stepResponsesCount = stepResponseCounts[s.step_id] ?? 0;
                        const hasInputRequirement = !!s.learner_response;
                        const responseText = !hasInputRequirement
                          ? "No response required"
                          : stepResponsesCount === 0
                          ? "No responses yet"
                          : `${stepResponsesCount} ${stepResponsesCount === 1 ? 'response' : 'responses'}`;

                        const dotColor = !hasInputRequirement
                          ? "bg-slate-200"
                          : stepResponsesCount === 0
                          ? "bg-amber-400"
                          : "bg-emerald-500 animate-pulse";

                        return (
                          <div
                            key={s.step_id}
                            onClick={() => setSelectedStepId(s.step_id)}
                            className="flex flex-col bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all h-[180px] max-h-[180px] overflow-hidden group select-none"
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-shrink-0">
                              <h3 className={`text-sm font-bold truncate group-hover:text-indigo-600 transition-colors ${getActivityColor(s.activityIndex ?? 0).text}`}>
                                {s.title}
                              </h3>
                            </div>

                            {/* Question Content */}
                            <div className="text-xs text-slate-600 mt-3 leading-relaxed flex-1 overflow-hidden">
                              <p className="line-clamp-3 font-medium">
                                {qText || "No question for this step."}
                              </p>
                            </div>

                            {/* Responses Count Badge */}
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-semibold flex-shrink-0">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                {responseText}
                              </span>
                              <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                View details &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Centered Overlay */}
                    {selectedStepId && (() => {
                      const selectedStep = allSteps.find(s => s.step_id === selectedStepId);
                      if (!selectedStep) return null;
                      const rType = selectedStep.learner_response?.response_type || "text_short";
                      return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-[95vw] md:w-[60vw] h-[80vh] flex flex-col overflow-hidden animate-scaleIn">
                            <ResponseSummaryPanel
                              sessionId={session.id}
                              stepId={selectedStepId}
                              responseType={rType as ResponseType}
                              options={selectedStep.learner_response?.options}
                              allSteps={allSteps}
                              initialResponses={allResponseRows}
                              onClose={() => setSelectedStepId(null)}
                              autoGenerateSummary={false}
                              layout="overlay"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
