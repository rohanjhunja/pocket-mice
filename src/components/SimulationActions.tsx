'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Play, Users } from 'lucide-react'
import { createSimulationLesson, createSimulationSession } from '@/app/dashboard/actions'

export function SimulationActions({ simulationId, simulationUrl }: { simulationId: string, simulationUrl: string }) {
  const router = useRouter()
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const handlePreview = async () => {
    setIsPreviewing(true)
    try {
      // Wrap the simulation in a temporary lesson and route to the existing preview player
      const lessonId = await createSimulationLesson(simulationId)
      router.push(`/preview/${lessonId}`)
    } catch (err: any) {
      alert(`Failed to launch preview: ${err.message}`)
      setIsPreviewing(false)
    }
  }

  const handleAssign = async () => {
    setIsAssigning(true)
    try {
      const sessionId = await createSimulationSession(simulationId)
      router.push(`/dashboard/session/${sessionId}`)
    } catch (err: any) {
      alert(`Failed to assign simulation: ${err.message}`)
      setIsAssigning(false)
    }
  }

  return (
    <div className="flex gap-3 mt-4 md:mt-0 items-start w-full md:w-auto">
      <Button variant="outline" className="flex-1 md:flex-none border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handlePreview} disabled={isPreviewing}>
        {isPreviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
        {isPreviewing ? 'Loading...' : 'Preview'}
      </Button>
      <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={handleAssign} disabled={isAssigning}>
        {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
        {isAssigning ? 'Creating...' : 'Assign to Class'}
      </Button>
    </div>
  )
}
