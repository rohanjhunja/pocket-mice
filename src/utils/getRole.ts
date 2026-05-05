import { type SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'teacher'

/**
 * Fetches the role for a given user from the profiles table.
 * Returns 'teacher' as a safe default if the profile doesn't exist or has no role set.
 */
export async function getRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = data?.role
  if (role === 'admin') return 'admin'
  return 'teacher'
}
