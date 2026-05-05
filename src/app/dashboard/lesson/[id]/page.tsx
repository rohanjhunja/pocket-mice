import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Clock, LayoutList, Copy } from 'lucide-react'
import { LessonActions } from '@/components/LessonActions'

export default async function LessonOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { id: lessonId } = await params

  // Fetch bookmarks
  const { data: profile } = await supabase
    .from('profiles')
    .select('bookmarks')
    .eq('id', user.id)
    .single()

  const bookmarks = profile?.bookmarks || []
  const initialIsBookmarked = bookmarks.includes(lessonId)

  // Any authenticated user can access any lesson — ownership check is removed.
  // isOwner controls whether editing happens in-place or creates a copy.
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single()

  if (error || !lesson) {
    return notFound()
  }

  const isOwner = lesson.teacher_id === user.id


  const jsonContent = lesson.json_content
  const totalActivities = jsonContent.activities?.length || 0
  let totalSteps = 0
  jsonContent.activities?.forEach((act: any) => {
    totalSteps += act.steps?.length || 0
  })

  // Basic time estimation heuristic: 3 mins per step
  const estimatedTime = totalSteps > 0 ? `${totalSteps * 3} mins` : 'Unknown'

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 inline-flex items-center text-sm font-medium mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Dashboard
      </Link>

      {/* Non-owner notice */}
      {!isOwner && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Copy className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <p>
            <span className="font-semibold">This lesson belongs to another teacher.</span>{' '}
            You can preview and launch it freely. Clicking <em>Edit</em> will automatically create a copy in your library first.
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{lesson.title}</h1>
          <p className="text-lg text-slate-600 mb-4 max-w-2xl">{lesson.description || 'No description provided'}</p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">Biology</Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">Interactive</Badge>
          </div>
        </div>

        <LessonActions 
          lessonId={lessonId}
          jsonContent={jsonContent}
          initialIsBookmarked={initialIsBookmarked}
          isOwner={isOwner}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center">
                <LayoutList className="w-5 h-5 mr-2 text-slate-500" />
                Index of Contents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {jsonContent.activities?.map((activity: any, actIdx: number) => (
                  <div key={activity.activity_id || actIdx} className="border-l-2 border-slate-200 pl-4 py-1">
                    <h3 className="font-semibold text-slate-800 mb-2">{activity.activity_title}</h3>
                    <ul className="space-y-2">
                      {activity.steps?.map((step: any, stepIdx: number) => (
                        <li key={step.step_id || stepIdx} className="text-slate-600 text-sm flex items-start">
                          <span className="bg-slate-200 text-slate-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-2 mt-0.5 flex-shrink-0">
                            {stepIdx + 1}
                          </span>
                          <span className="leading-snug">{step.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-slate-600">
                <Clock className="w-5 h-5 mr-3 text-slate-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Time</div>
                  <div className="font-medium text-slate-900">{estimatedTime}</div>
                </div>
              </div>
              <div className="flex items-center text-slate-600">
                <LayoutList className="w-5 h-5 mr-3 text-slate-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Scope</div>
                  <div className="font-medium text-slate-900">{totalActivities} Activities ({totalSteps} Steps)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="font-semibold block text-slate-700">Grade Level</span>
                <span className="text-slate-600">High School (9-12)</span>
              </div>
              <div>
                <span className="font-semibold block text-slate-700">Curriculum</span>
                <span className="text-slate-600">NGSS: HS-LS4-4</span>
              </div>
              <div>
                <span className="font-semibold block text-slate-700">Source</span>
                <span className="text-slate-600">HHMI BioInteractive</span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
