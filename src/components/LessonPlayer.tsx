"use client";

import { useState, useEffect } from "react";
import { ProgressHeader } from "./ProgressHeader";
import { MediaBackground } from "./MediaBackground";
import { InstructionOverlay } from "./InstructionOverlay";
import { ResponseForm } from "./ResponseForm";
import { CompletionCard } from "./CompletionCard";
import { submitResponse, trackEvent } from "@/app/play/[code]/actions";
import { toast } from "sonner";

interface LessonPlayerProps {
  session: any;
  student: any;
  initialResponses: Record<string, string>;
  resumeStepIndex?: number;
}

export default function LessonPlayer({ session, student, initialResponses, resumeStepIndex = 0 }: LessonPlayerProps) {
  const [allSteps, setAllSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(resumeStepIndex);
  const [learnerResponses, setLearnerResponses] = useState<Record<string, string>>(initialResponses);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [currentInputValue, setCurrentInputValue] = useState("");
  const [isVideoTheme, setIsVideoTheme] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Flatten selected steps from session configuration
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

  useEffect(() => {
    if (allSteps.length > 0) {
      const step = allSteps[currentStepIndex];
      setCurrentInputValue(learnerResponses[step.step_id] || "");
      setIsMinimized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, allSteps.length]);

  if (allSteps.length === 0) {
    return <div className="h-screen flex items-center justify-center text-slate-500 bg-slate-50">Initializing session footprint...</div>;
  }

  const step = allSteps[currentStepIndex];
  
  const handleSaveResponse = async () => {
    if (step.learner_response) {
      const val = currentInputValue;
      setLearnerResponses(prev => ({ ...prev, [step.step_id]: val }));
      
      try {
        setIsSubmitting(true);
        await submitResponse(student.id, session.id, step.step_id, val);
      } catch (e) {
        toast.error("Failed to save response. Please check connection.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleNext = async () => {
    await handleSaveResponse();
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setShowCompletion(true);
    }
  };

  const handleBack = async () => {
    if (currentStepIndex > 0) {
      await handleSaveResponse();
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-300 ${isVideoTheme ? 'bg-black' : 'bg-slate-50'}`}>
      <ProgressHeader 
        title={session.lessons?.title || "Live Lesson"} 
        currentStep={currentStepIndex} 
        totalSteps={allSteps.length} 
      />
      
      <main className="flex-1 relative overflow-hidden">
        <MediaBackground 
          media={step.interactive_or_media} 
          onThemeChange={setIsVideoTheme}
          onMediaInteraction={(eventType) => {
            trackEvent(student.id, session.id, step.step_id, eventType);
          }}
        />
        
        <InstructionOverlay 
          step={step} 
          isMinimized={isMinimized} 
          onToggleMinimize={() => setIsMinimized(!isMinimized)}
        >
          <ResponseForm 
            responseReq={step.learner_response}
            currentValue={currentInputValue}
            onChange={setCurrentInputValue}
            onSubmit={handleNext}
            onBack={handleBack}
            canGoBack={currentStepIndex > 0}
            isLastStep={currentStepIndex === allSteps.length - 1}
            isSubmitting={isSubmitting}
          />
        </InstructionOverlay>

        {showCompletion && <CompletionCard />}
      </main>
    </div>
  );
}
