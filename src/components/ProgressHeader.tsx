import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ProgressHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  isPreview?: boolean;
  lessonId?: string;
}

export function ProgressHeader({ title, currentStep, totalSteps, isPreview, lessonId }: ProgressHeaderProps) {
  // calculate progress percentage (0 to 100)
  const progressPercent = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  return (
    <div className="bg-white px-6 py-3 border-b border-slate-200 z-50 shadow-sm relative">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-base text-slate-900">{title}</h1>
          {isPreview && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 uppercase tracking-wider text-[10px] font-bold">
              Preview Mode
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 font-medium">
            Step {currentStep + 1} of {totalSteps}
          </span>
          {isPreview && (
            <Link href={lessonId ? `/dashboard/lesson/${lessonId}` : '/dashboard'}>
              <Button variant="secondary" size="sm" className="h-8">
                <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Lesson Overview
              </Button>
            </Link>
          )}
        </div>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
    </div>
  );
}
