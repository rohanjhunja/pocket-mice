import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface ResponseFormProps {
  responseReq: any;
  currentValue: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isLastStep: boolean;
  isSubmitting?: boolean;
}

export function ResponseForm({ 
  responseReq, 
  currentValue, 
  onChange, 
  onSubmit, 
  onBack, 
  canGoBack, 
  isLastStep,
  isSubmitting = false
}: ResponseFormProps) {
  
  // Decide next button state
  const isNextDisabled = responseReq?.response_required && !currentValue.trim();
  const nextText = responseReq?.response_required ? 'Submit' : (isLastStep ? 'Finish' : 'Continue');

  return (
    <div className="flex flex-col h-full">
      {/* Input Area */}
      {responseReq && (
        <div className="mt-4 pt-4 border-t border-slate-200 flex-1 overflow-y-auto">
          {/* Note: The user explicitly requested to hide the prompt text here (display: none in CSS earlier) */}
          <Label className="hidden font-medium mb-2 text-slate-700">
            {responseReq.prompt}
          </Label>

          {responseReq.response_type === 'dropdown' && (
            <Select value={currentValue} onValueChange={(val) => onChange(val || '')}>
              <SelectTrigger className="w-full text-[15px] px-3 py-2.5 h-auto">
                <SelectValue placeholder={responseReq.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {responseReq.options?.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {responseReq.response_type === 'text_long' && (
            <Textarea 
              placeholder={responseReq.placeholder || ''} 
              maxLength={responseReq.max_length}
              value={currentValue}
              onChange={e => onChange(e.target.value)}
              className="resize-y min-h-[100px] text-[15px] px-3 py-2.5 h-auto"
            />
          )}

          {(!responseReq.response_type || responseReq.response_type === 'text_short') && (
            <Input 
              type="text" 
              placeholder={responseReq.placeholder || ''} 
              maxLength={responseReq.max_length}
              value={currentValue}
              onChange={e => onChange(e.target.value)}
              className="text-[15px] px-3 py-2.5 h-auto"
            />
          )}
        </div>
      )}
      {!responseReq && <div className="flex-1" />}

      {/* Navigation Footer */}
      <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-50 flex justify-between gap-3 p-5 -mx-5 -mb-5 shrink-0 rounded-b-xl">
         <Button 
           variant="outline" 
           onClick={onBack} 
           disabled={!canGoBack}
           className="bg-white text-slate-900 flex-none text-[15px] px-4 py-2.5 h-auto"
         >
           Back
         </Button>
         <Button 
           onClick={onSubmit} 
           disabled={isNextDisabled || isSubmitting}
           className="bg-blue-600 hover:bg-blue-700 text-white flex-1 text-[15px] px-4 py-2.5 h-auto"
         >
           {isSubmitting ? 'Saving...' : nextText}
         </Button>
      </div>
    </div>
  );
}
