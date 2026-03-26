'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deleteSession } from '@/app/dashboard/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Clock, Users, ChevronRight, LayoutGrid, MoreVertical } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function RecentSessionsArea({ sessions }: { sessions: any[] }) {
  const [viewAll, setViewAll] = useState(false)

  if (!sessions || sessions.length === 0) return null

  const displaySessions = viewAll ? sessions : sessions.slice(0, 5)

  return (
    <div className="mb-12">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-xl font-bold text-slate-800">Recent Sessions</h3>
        {sessions.length > 5 && (
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
                  <div>
                    <CardTitle className="text-base line-clamp-1">{session.lessons?.title || 'Unknown Lesson'}</CardTitle>
                    <CardDescription className="text-xs font-mono text-blue-600 mt-1">Code: {session.session_code}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-slate-100 h-8 w-8 -mt-2 -mr-2 text-slate-400 hover:text-slate-600 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring" onClick={(e: React.MouseEvent) => e.preventDefault()}>
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                        onClick={async (e: React.MouseEvent) => {
                          e.preventDefault();
                          if (window.confirm('Are you sure you want to delete this session?')) {
                            try {
                              await deleteSession(session.id);
                            } catch (err: any) {
                              alert(`Failed to delete session: ${err.message}`);
                            }
                          }
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
