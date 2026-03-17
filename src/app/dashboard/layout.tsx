import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-xl text-slate-800">Teacher Dashboard</h1>
        <form action="/auth/signout" method="post">
          <Button variant="outline" size="sm" type="submit">Sign out</Button>
        </form>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
