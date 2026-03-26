'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { uploadLesson } from '@/app/dashboard/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Upload, BookOpen, Plus } from 'lucide-react'
import { LessonEditor } from '@/components/LessonEditor'

export function LessonDashboardArea({ initialLessons }: { initialLessons: any[] }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const EMPTY_LESSON_TEMPLATE = {
    lesson_id: '', lesson_title: '', lesson_description: '',
    source_reference: '', estimated_duration_minutes: 0,
    difficulty_level: '', grade_level: '', learning_objectives: [],
    total_activity_count: 0, total_step_count: 0, activities: [],
  }

  const filteredLessons = initialLessons.filter(lesson => 
    lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (lesson.description && lesson.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const newLesson = await uploadLesson(json)
      // Navigate to the new lesson overview
      router.push(`/dashboard/lesson/${newLesson.id}`)
    } catch (err: any) {
      alert(`Failed to upload JSON: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = '' // reset input
    }
  }

  return (
    <>
    <div className="space-y-8">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input 
            placeholder="Search lessons by keyword..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 items-center">
          <input 
            type="file" 
            accept=".json" 
            id="json-upload" 
            className="hidden" 
            onChange={handleFileUpload} 
            disabled={isUploading}
          />
          <Button disabled={isUploading} className="w-full sm:w-auto" onClick={() => document.getElementById('json-upload')?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload .json Lesson'}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Lesson
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filteredLessons.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No lessons found</h3>
          <p className="text-slate-500 mt-1">Try uploading a new .json lesson file to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map(lesson => (
            <Card key={lesson.id} className="flex flex-col hover:border-blue-200 transition-colors">
              <CardHeader className="flex-1">
                <CardTitle className="text-lg line-clamp-2">{lesson.title}</CardTitle>
                <CardDescription className="line-clamp-3 mt-2">
                  {lesson.description || 'No description provided.'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="border-t pt-4 border-slate-100 bg-slate-50">
                <Link href={`/dashboard/lesson/${lesson.id}`} className="w-full block">
                  <Button variant="secondary" className="w-full bg-white hover:bg-slate-100 border-slate-200 cursor-pointer">
                    View Overview
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>

    {isCreating && (
      <LessonEditor
        jsonContent={EMPTY_LESSON_TEMPLATE}
        onClose={() => setIsCreating(false)}
        createMode
      />
    )}
    </>
  )
}
