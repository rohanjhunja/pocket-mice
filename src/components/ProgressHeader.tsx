import { Progress } from "@/components/ui/progress";

interface ProgressHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
}

export function ProgressHeader({ title, currentStep, totalSteps }: ProgressHeaderProps) {
  // calculate progress percentage (0 to 100)
  const progressPercent = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 100;

  return (
    <div className="bg-white px-6 py-3 border-b border-slate-200 z-50 shadow-sm relative">
      <div className="flex justify-between items-center mb-2">
        <h1 className="font-semibold text-base text-slate-900">{title}</h1>
        <span className="text-sm text-slate-500 font-medium">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>
      <Progress value={progressPercent} className="h-1.5" />
    </div>
  );
}
