'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Upload, Plus, Globe, Activity, Loader2, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { uploadSimulation, addSimulationByUrl } from '@/app/dashboard/actions'

interface SimulationsDashboardAreaProps {
  simulations: any[]
}

export function SimulationsDashboardArea({ simulations }: SimulationsDashboardAreaProps) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  
  // URL Add Modal State
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isAddingUrl, setIsAddingUrl] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name)
      const sim = await uploadSimulation(formData)
      router.push(`/dashboard/simulation/${sim.id}`)
    } catch (err: any) {
      alert(`Failed to upload simulation: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleAddByUrl = async () => {
    if (!urlInput.trim()) return
    let normalizedUrl = urlInput.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }
    
    setIsAddingUrl(true)
    try {
      const result = await addSimulationByUrl(normalizedUrl)
      if (result.exists) {
        alert('This simulation URL is already being tracked!')
      }
      setIsUrlModalOpen(false)
      setUrlInput('')
      router.push(`/dashboard/simulation/${result.id}`)
    } catch (err: any) {
      alert(`Failed to add simulation: ${err.message}`)
    } finally {
      setIsAddingUrl(false)
    }
  }

  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Tracked Simulations
          </h3>
          <p className="text-sm text-slate-500 mt-1">Simulations you have added or uploaded</p>
        </div>
        
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <input
            type="file"
            accept=".html"
            id="html-sim-upload"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <Button variant="outline" disabled={isUploading} className="w-full sm:w-auto" onClick={() => document.getElementById('html-sim-upload')?.click()}>
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />Upload .html</>
            )}
          </Button>
          <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={() => setIsUrlModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add by URL
          </Button>
        </div>
      </div>

      {simulations.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <Activity className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-700">No simulations tracked</h3>
          <p className="text-slate-500 mt-1 text-sm">Upload an HTML file or add a URL to start tracking health and assignments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {simulations.map(sim => (
            <Link key={sim.id} href={`/dashboard/simulation/${sim.id}`} className="block">
              <Card className="h-full hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col group">
                <CardHeader className="pb-3 flex-1">
                  <CardTitle className="text-base line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
                    {sim.title}
                  </CardTitle>
                  <p className="text-xs text-slate-400 font-mono truncate mt-1">{sim.url}</p>
                </CardHeader>
                <CardContent className="pt-0 pb-4 mt-auto">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`${sim.healthColor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {sim.healthStatus || 'No Data'}
                    </Badge>
                    {sim.runsCount !== undefined && (
                      <span className="text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        {sim.runsCount} runs
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add by URL Modal */}
      <Dialog open={isUrlModalOpen} onOpenChange={(o) => !o && !isAddingUrl && setIsUrlModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Simulation by URL</DialogTitle>
            <DialogDescription>
              Enter the exact URL of the simulation. We will attempt to automatically fetch its title.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              placeholder="https://phet.colorado.edu/sims/html/..." 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddByUrl()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUrlModalOpen(false)} disabled={isAddingUrl}>Cancel</Button>
            <Button onClick={handleAddByUrl} disabled={!urlInput.trim() || isAddingUrl}>
              {isAddingUrl ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...</> : 'Add Simulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
