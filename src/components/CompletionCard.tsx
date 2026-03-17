import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface CompletionCardProps {
  onFinish?: () => void;
}

export function CompletionCard({ onFinish }: CompletionCardProps) {
  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
      <Card className="w-11/12 max-w-md text-center shadow-xl animate-in slide-in-from-bottom-8 duration-500">
        <CardHeader>
          <CardTitle className="text-2xl text-emerald-500">Lesson Completed!</CardTitle>
          <CardDescription className="text-slate-700 text-base mt-2">
            You have successfully completed this lesson activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={() => {
              if (onFinish) onFinish();
              else alert('Returned to course module (POC End)');
            }}
          >
            Next Activity
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
