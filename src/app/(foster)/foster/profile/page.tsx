import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FosterProfileForm } from '@/components/foster/foster-profile-form'
import { AccountSettingsForm } from '@/components/account-settings-form'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { FosterParent } from '@/types/database'

export default async function FosterProfilePage(): Promise<React.JSX.Element> {
  let fosterData: FosterParent | null = null
  let currentEmail = 'you@example.com'
  let authProvider: string | null = null
  let fetchError = false

  if (!DEV_MODE) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) {
        redirect('/login')
      }

      currentEmail = user.email ?? 'unknown'
      authProvider = (user.app_metadata?.provider as string | undefined) ?? null

      // A missing row is expected for fresh fosters; only real query errors
      // (network, permission, etc.) should surface as a fetch failure.
      const { data, error } = await supabase
        .from('foster_parents')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      fosterData = (data as FosterParent) ?? null
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[foster/profile] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      {fetchError ? (
        <ServerErrorPanel />
      ) : (
        <>
          <FosterProfileForm initialData={fosterData} />
          <AccountSettingsForm currentEmail={currentEmail} authProvider={authProvider} />
        </>
      )}
    </div>
  )
}
