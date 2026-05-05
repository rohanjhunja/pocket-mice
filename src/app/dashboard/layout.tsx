import { createClient } from '@/utils/supabase/server'
import { getRole } from '@/utils/getRole'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user ? await getRole(supabase, user.id) : 'teacher'
  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-xl text-slate-800">
            {isAdmin ? 'Admin Dashboard' : 'Teacher Dashboard'}
          </h1>
          {isAdmin && (
            <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              Super Admin
            </span>
          )}
        </div>
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

