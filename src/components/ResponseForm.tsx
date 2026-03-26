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
  
  // Normalize legacy response types to current values
  const normalizedType = (() => {
    const t = responseReq?.response_type
    if (t === 'open_ended') return 'text_long'
    if (t === 'short_answer') return 'text_short'
    return t
  })()

  // Decide next button state
  const isNextDisabled = responseReq?.response_required && !currentValue.trim();
  const nextText = responseReq?.response_required ? 'Submit' : (isLastStep ? 'Finish' : 'Continue');

  return (
    <div className="flex flex-col h-full">
      {/* Input Area */}
      {responseReq && (
        <div className="mt-4 pt-4 flex-1 overflow-y-auto">
          {responseReq.prompt && (
            <Label className="font-medium mb-2 text-slate-700">
              {responseReq.prompt}
            </Label>
          )}

          {normalizedType === 'dropdown' && (
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

          {normalizedType === 'multiple_choice' && (
            <div className="space-y-2">
              {responseReq.options?.map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(opt)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-[15px] transition-colors ${
                    currentValue === opt
                      ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      currentValue === opt ? 'border-blue-500' : 'border-slate-300'
                    }`}>
                      {currentValue === opt && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    {opt}
                  </div>
                </button>
              ))}
            </div>
          )}

          {normalizedType === 'text_long' && (
            <Textarea 
              placeholder={responseReq.placeholder || ''} 
              maxLength={responseReq.max_length}
              value={currentValue}
              onChange={e => onChange(e.target.value)}
              className="resize-y min-h-[100px] text-[15px] px-3 py-2.5 h-auto"
            />
          )}

          {(!normalizedType || normalizedType === 'text_short') && (
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
