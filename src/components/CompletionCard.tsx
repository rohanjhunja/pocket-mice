import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

interface CompletionCardProps {
  isPreview?: boolean;
  lessonId?: string;
}

export function CompletionCard({ isPreview, lessonId }: CompletionCardProps) {
  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
      <Card className="w-11/12 max-w-md text-center shadow-xl animate-in slide-in-from-bottom-8 duration-500 border-none">
        <CardHeader className="pb-4">
          <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-slate-800">Lesson Completed!</CardTitle>
          <CardDescription className="text-slate-500 text-base mt-2">
            You have successfully completed this lesson activity.
          </CardDescription>
        </CardHeader>
        {isPreview && (
          <CardContent>
            <Link href={`/dashboard/lesson/${lessonId}`}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Return to Lesson Overview
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
