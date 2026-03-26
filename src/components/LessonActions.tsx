'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Play, Pencil, Eye, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LessonEditor } from '@/components/LessonEditor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toggleBookmark, createSession } from '@/app/dashboard/lesson/[id]/actions'

interface LessonActionsProps {
  lessonId: string
  jsonContent: any
  initialIsBookmarked: boolean
}

export function LessonActions({ lessonId, jsonContent, initialIsBookmarked }: LessonActionsProps) {
  const router = useRouter()
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked)
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false)
  const [isLaunchLoading, setIsLaunchLoading] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isLaunchOpen, setIsLaunchOpen] = useState(false)

  // Initialize selected steps state with all steps checked by default
  const initialCheckedState: Record<string, boolean> = {}
  jsonContent.activities?.forEach((activity: any) => {
    activity.steps?.forEach((step: any) => {
      initialCheckedState[step.step_id || step.title] = true
    })
  })
  
  const [selectedSteps, setSelectedSteps] = useState(initialCheckedState)



  const handleBookmark = async () => {
    setIsBookmarkLoading(true)
    try {
      const newStatus = await toggleBookmark(lessonId, isBookmarked)
      setIsBookmarked(newStatus)
      toast(newStatus ? 'Lesson Bookmarked' : 'Bookmark Removed')
    } catch (error: any) {
      toast.error('Failed to update bookmark', { description: error.message })
    } finally {
      setIsBookmarkLoading(false)
    }
  }

  const toggleStep = (stepId: string) => {
    setSelectedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }))
  }

  const handleLaunch = async () => {
    setIsLaunchLoading(true)
    try {
      // Rebuild the selected_steps_json based on the toggled state
      const filteredActivities = jsonContent.activities?.map((activity: any) => {
        const keptSteps = activity.steps?.filter((step: any) => selectedSteps[step.step_id || step.title])
        return {
          ...activity,
          steps: keptSteps
        }
      }).filter((activity: any) => activity.steps && activity.steps.length > 0)

      const payload = {
        ...jsonContent,
        activities: filteredActivities
      }

      const sessionId = await createSession(lessonId, payload)
      
      toast.success('Session Created Successfully!')
      // Redirect to the new Session Dashboard
      router.push(`/dashboard/session/${sessionId}`)
    } catch (error: any) {
      toast.error('Failed to create session', { description: error.message })
      setIsLaunchLoading(false)
    }
  }

  return (
    <>
    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
      <Button 
        variant="outline" 
        className="flex-1 md:flex-none" 
        onClick={() => setIsEditorOpen(true)}
      >
        <Pencil className="w-4 h-4 mr-2" /> Edit
      </Button>

      <Button 
        variant="outline" 
        className="flex-1 md:flex-none" 
        onClick={handleBookmark} 
        disabled={isBookmarkLoading}
      >
        <Bookmark className={`w-4 h-4 mr-2 ${isBookmarked ? 'fill-current' : ''}`} /> 
        {isBookmarked ? 'Bookmarked' : 'Bookmark'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 flex-1 md:flex-none shadow-sm cursor-pointer border-0">
          <Play className="w-4 h-4 mr-2" /> Launch
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/preview/${lessonId}`)} className="cursor-pointer">
            <Eye className="w-4 h-4 mr-2 text-slate-500" /> Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsLaunchOpen(true)} className="cursor-pointer">
            <Users className="w-4 h-4 mr-2 text-slate-500" /> Assign to Class
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Session Launch</DialogTitle>
            <DialogDescription>
              Select the specific activities and steps you want to include in this live session for your students.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {jsonContent.activities?.map((activity: any, actIdx: number) => (
              <div key={activity.activity_id || actIdx} className="space-y-3">
                <h4 className="font-semibold text-slate-900 border-b pb-1">{activity.activity_title}</h4>
                <div className="space-y-3 pl-2">
                  {activity.steps?.map((step: any, stepIdx: number) => {
                    const stepKey = step.step_id || step.title
                    return (
                      <div key={stepKey} className="flex items-start space-x-3">
                        <Checkbox 
                          id={`step-${stepKey}`} 
                          checked={selectedSteps[stepKey]} 
                          onCheckedChange={() => toggleStep(stepKey)}
                          className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor={`step-${stepKey}`}
                            className="text-sm font-medium leading-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <span className="text-slate-500 mr-2">{stepIdx + 1}.</span>
                            {step.title}
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={handleLaunch} disabled={isLaunchLoading} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              {isLaunchLoading ? 'Creating Session...' : 'Confirm & Generate Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {isEditorOpen && (
      <LessonEditor
        lessonId={lessonId}
        jsonContent={jsonContent}
        onClose={() => setIsEditorOpen(false)}
      />
    )}
    </>
  )
}
