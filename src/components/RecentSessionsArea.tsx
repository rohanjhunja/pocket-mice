'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteSession } from '@/app/dashboard/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, Users, ChevronDown, ChevronUp, MoreVertical, Loader2, Trash2, ShieldAlert } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface RecentSessionsAreaProps {
  sessions: any[]
  isAdmin?: boolean
}

export function RecentSessionsArea({ sessions, isAdmin = false }: RecentSessionsAreaProps) {
  const [viewAll, setViewAll] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null)

  if (!sessions || sessions.length === 0) return null

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return
    setDeletingId(sessionToDelete.id)
    try {
      await deleteSession(sessionToDelete.id)
      setSessionToDelete(null)
    } catch (err: any) {
      alert(`Failed to delete session: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const showButton = sessions.length > 1
  const buttonVisibilityClass = 
    sessions.length > 3 ? 'block' :
    sessions.length === 3 ? 'lg:hidden block' :
    sessions.length === 2 ? 'md:hidden block' :
    'hidden'
  const buttonContainerClass = viewAll ? 'block' : buttonVisibilityClass

  return (
    <>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session, index) => {
          const itemClass = viewAll
            ? "block"
            : index === 0
            ? "block"
            : index === 1
            ? "hidden md:block"
            : index === 2
            ? "hidden lg:block"
            : "hidden"

          return (
            <Link key={session.id} href={`/dashboard/session/${session.id}`} className={itemClass}>
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
                            onClick={(e: React.MouseEvent) => {
                              e.preventDefault()
                              setSessionToDelete(session)
                            }}
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
          )
        })}
      </div>

      {showButton && (
        <div className={`flex justify-center mt-6 ${buttonContainerClass}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewAll(!viewAll)}
            className="px-6 py-2 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all rounded-full flex items-center gap-2 shadow-xs"
          >
            {viewAll ? (
              <>
                Show Less
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                See More
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>

    {/* Custom Delete Confirmation Modal */}
    <Dialog open={!!sessionToDelete} onOpenChange={(isOpen) => !isOpen && !deletingId && setSessionToDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Session</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the session for <strong>{sessionToDelete?.lessons?.title || 'Unknown Lesson'}</strong>? All student data will be permanently removed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setSessionToDelete(null)} disabled={!!deletingId}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={!!deletingId}>
            {deletingId ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Delete Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

