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
      session.selected_steps_json.activities.forEach((activity: any) => {
        if (activity.steps) {
          activity.steps.forEach((step: any) => {
            steps.push(step);
          });
        }
      });
    }
    setAllSteps(steps);
  }, [session]);

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

  const step = allSteps[currentStepIndex];

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
      />

      <main className="flex-1 relative overflow-hidden">
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
            />
          </InstructionOverlay>
        )}

        {showCompletion && !isSimulationWrapper && (
          <CompletionCard isPreview={isPreview} lessonId={session.lessons?.id} />
        )}
      </main>
    </div>
  );
}
