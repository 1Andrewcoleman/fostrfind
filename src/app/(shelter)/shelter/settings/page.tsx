import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShelterSettingsForm } from '@/components/shelter/shelter-settings-form'

export const metadata: Metadata = { title: 'Shelter Settings' }
import { AccountSettingsForm } from '@/components/account-settings-form'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Shelter } from '@/types/database'

/** Placeholder used when no Supabase connection is configured. */
const DEV_SHELTER: Shelter = {
  id: 'dev',
  created_at: new Date().toISOString(),
  user_id: 'dev',
  name: 'Happy Paws Rescue',
  slug: 'happy-paws-rescue',
  email: 'shelter@example.com',
  phone: null,
  location: 'Austin, TX',
  latitude: null,
  longitude: null,
  logo_url: null,
  ein: null,
  bio: null,
  website: null,
  instagram: null,
  is_verified: false,
}

export default async function ShelterSettingsPage(): Promise<React.JSX.Element> {
  let shelterData: Shelter | null = null
  let currentEmail = 'you@example.com'
  let authProvider: string | null = null
  let fetchError = false

  if (DEV_MODE) {
    shelterData = DEV_SHELTER
  } else {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) redirect('/login')

      currentEmail = user.email ?? 'unknown'
      authProvider = (user.app_metadata?.provider as string | undefined) ?? null

      // Missing row is an expected state (user needs onboarding), so use
      // maybeSingle so the try/catch doesn't turn it into a fetch failure.
      const { data, error } = await supabase
        .from('shelters')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      shelterData = (data as Shelter) ?? null
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[shelter/settings] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <ServerErrorPanel />
      </div>
    )
  }

  if (!shelterData) {
    redirect('/onboarding')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ShelterSettingsForm initialData={shelterData} />
      <AccountSettingsForm currentEmail={currentEmail} authProvider={authProvider} />
    </div>
  )
}
