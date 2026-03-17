'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { joinSessionAction } from './actions'

export function JoinForm({ sessionId, sessionCode }: { sessionId: string, sessionCode: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    startTransition(async () => {
      try {
        await joinSessionAction(sessionId, sessionCode, name.trim())
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-left">
        <Label htmlFor="name" className="text-slate-700">Your Full Name</Label>
        <Input 
          id="name" 
          placeholder="e.g. Jane Doe" 
          value={name} 
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          disabled={isPending}
          required
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      </div>

      <Button type="submit" size="lg" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isPending || !name.trim()}>
        {isPending ? 'Joining...' : 'Join Classroom'}
      </Button>
    </form>
  )
}
