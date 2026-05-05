'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { uploadLesson, deleteLesson, getAllLessons } from '@/app/dashboard/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Upload, BookOpen, Plus, MoreVertical, Loader2, Trash2, Globe, ShieldAlert } from 'lucide-react'
import { LessonEditor } from '@/components/LessonEditor'

interface LessonDashboardAreaProps {
  initialLessons: any[]
  isAdmin?: boolean
  currentUserId?: string
}

export function LessonDashboardArea({ initialLessons, isAdmin = false, currentUserId = '' }: LessonDashboardAreaProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Global library state
  const [showGlobal, setShowGlobal] = useState(false)
  const [globalLessons, setGlobalLessons] = useState<any[]>([])
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false)

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

  const filteredGlobal = globalLessons.filter(lesson =>
    lesson.teacher_id !== currentUserId && (
      lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lesson.description && lesson.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const newLesson = await uploadLesson(json)
      router.push(`/dashboard/lesson/${newLesson.id}`)
    } catch (err: any) {
      alert(`Failed to upload JSON: ${err.message}`)
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeleteLesson = async (e: React.MouseEvent, lessonId: string) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this lesson?')) return
    setDeletingId(lessonId)
    try {
      await deleteLesson(lessonId)
    } catch (err: any) {
      alert(`Failed to delete lesson: ${err.message}`)
      setDeletingId(null)
    }
  }

  const handleToggleGlobal = async () => {
    if (showGlobal) {
      setShowGlobal(false)
      return
    }
    setIsLoadingGlobal(true)
    setShowGlobal(true)
    try {
      const all = await getAllLessons()
      setGlobalLessons(all)
    } catch (err: any) {
      alert(`Failed to load global library: ${err.message}`)
      setShowGlobal(false)
    } finally {
      setIsLoadingGlobal(false)
    }
  }

  const renderLessonCard = (lesson: any, isOwned: boolean) => (
    <Card key={lesson.id} className="flex flex-col hover:border-blue-200 transition-colors">
      <CardHeader className="flex-1">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg line-clamp-2">{lesson.title}</CardTitle>
            {!isOwned && lesson.teacher_email && (
              <p className="text-xs text-slate-400 mt-1 truncate">By {lesson.teacher_email}</p>
            )}
          </div>
          {isOwned && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-slate-100 h-8 w-8 -mt-2 -mr-2 text-slate-400 hover:text-slate-600 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                disabled={deletingId === lesson.id}
              >
                <span className="sr-only">Open menu</span>
                {deletingId === lesson.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <MoreVertical className="h-4 w-4" />
                }
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                  onClick={(e: React.MouseEvent) => handleDeleteLesson(e, lesson.id)}
                  disabled={deletingId === lesson.id}
                >
                  {deletingId === lesson.id
                    ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Deleting…</>
                    : <><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</>
                  }
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <CardDescription className="line-clamp-3 mt-2">
          {lesson.description || 'No description provided.'}
        </CardDescription>
      </CardHeader>
      <CardFooter className="border-t pt-4 border-slate-100 bg-slate-50">
        <Link href={`/dashboard/lesson/${lesson.id}`} className="w-full block">
          <Button variant="secondary" className="w-full bg-white hover:bg-slate-100 border-slate-200 cursor-pointer">
            {isOwned ? 'View Overview' : 'View & Use'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )

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
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" />Upload .json Lesson</>
            )}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Lesson
          </Button>
        </div>
      </div>

      {/* Own Lessons Grid */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-semibold text-violet-700">Showing all lessons across all teachers</span>
        </div>
      )}

      {filteredLessons.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl">
          <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No lessons found</h3>
          <p className="text-slate-500 mt-1">Try uploading a new .json lesson file to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map(lesson => renderLessonCard(lesson, isAdmin || lesson.teacher_id === currentUserId))}
        </div>
      )}

      {/* Global Library Section — teachers only */}
      {!isAdmin && (
        <div className="pt-4 border-t border-slate-200">
          <Button
            variant="ghost"
            className="text-slate-500 hover:text-slate-900 text-sm gap-2"
            onClick={handleToggleGlobal}
            disabled={isLoadingGlobal}
          >
            {isLoadingGlobal ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Loading Global Library…</>
            ) : (
              <><Globe className="w-4 h-4" />{showGlobal ? 'Hide Global Library' : 'View Global Library'}</>
            )}
          </Button>

          {showGlobal && !isLoadingGlobal && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-slate-700">Global Library</h4>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Lessons from other teachers · Editing creates a copy
                </span>
              </div>

              {filteredGlobal.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">No other lessons available yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGlobal.map(lesson => renderLessonCard(lesson, false))}
                </div>
              )}
            </div>
          )}
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
