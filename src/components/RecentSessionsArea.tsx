'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteSession } from '@/app/dashboard/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Clock, Users, ChevronRight, LayoutGrid, MoreVertical, Loader2, Trash2, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface RecentSessionsAreaProps {
  sessions: any[]
  isAdmin?: boolean
}

export function RecentSessionsArea({ sessions, isAdmin = false }: RecentSessionsAreaProps) {
  const [viewAll, setViewAll] = useState(isAdmin) // admin defaults to grid view
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (!sessions || sessions.length === 0) return null

  const displaySessions = viewAll ? sessions : sessions.slice(0, 5)

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    if (!window.confirm('Are you sure you want to delete this session?')) return
    setDeletingId(sessionId)
    try {
      await deleteSession(sessionId)
    } catch (err: any) {
      alert(`Failed to delete session: ${err.message}`)
      setDeletingId(null)
    }
  }

  return (
    <div className="mb-12">
      <div className="flex justify-between items-end mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-slate-800">
            {isAdmin ? 'All Sessions' : 'Recent Sessions'}
          </h3>
          {isAdmin && (
            <span className="flex items-center gap-1 text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              <ShieldAlert className="w-3 h-3" /> Admin View
            </span>
          )}
        </div>
        {sessions.length > 5 && !isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setViewAll(!viewAll)} className="text-blue-600 hover:text-blue-700">
            {viewAll ? (
              <><ChevronRight className="w-4 h-4 mr-1" /> Show Less</>
            ) : (
              <><LayoutGrid className="w-4 h-4 mr-1" /> View All</>
            )}
          </Button>
        )}
      </div>

      <div className={viewAll 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
        : "flex overflow-x-auto pb-4 gap-6 snap-x smooth-scrollbar"
      }>
        {displaySessions.map(session => (
          <Link key={session.id} href={`/dashboard/session/${session.id}`} className={viewAll ? "block" : "min-w-[300px] max-w-[300px] snap-start"}>
            <Card className="h-full hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base line-clamp-1">{session.lessons?.title || 'Unknown Lesson'}</CardTitle>
                    <CardDescription className="text-xs font-mono text-blue-600 mt-1">Code: {session.session_code}</CardDescription>
                    {isAdmin && session.teacher_email && (
                      <p className="text-xs text-slate-400 mt-1 truncate">By {session.teacher_email}</p>
                    )}
                  </div>
                  {!isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-slate-100 h-8 w-8 -mt-2 -mr-2 text-slate-400 hover:text-slate-600 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        onClick={(e: React.MouseEvent) => e.preventDefault()}
                        disabled={deletingId === session.id}
                      >
                        <span className="sr-only">Open menu</span>
                        {deletingId === session.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <MoreVertical className="h-4 w-4" />
                        }
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                          onClick={(e: React.MouseEvent) => handleDeleteSession(e, session.id)}
                          disabled={deletingId === session.id}
                        >
                          {deletingId === session.id
                            ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Deleting…</>
                            : <><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</>
                          }
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500 bg-slate-50/50 rounded-b-xl">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{session.studentCount} Students</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

