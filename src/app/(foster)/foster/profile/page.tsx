import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FosterProfileForm } from '@/components/foster/foster-profile-form'
import { AccountSettingsForm } from '@/components/account-settings-form'
import { DEV_MODE } from '@/lib/constants'
import type { FosterParent } from '@/types/database'

export default async function FosterProfilePage(): Promise<React.JSX.Element> {
  let fosterData: FosterParent | null = null
  let currentEmail = 'you@example.com'
  let authProvider: string | null = null

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    currentEmail = user.email ?? 'unknown'
    authProvider = (user.app_metadata?.provider as string | undefined) ?? null

    const { data } = await supabase
      .from('foster_parents')
      .select('*')
      .eq('user_id', user.id)
      .single()

    fosterData = (data as FosterParent) ?? null
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <FosterProfileForm initialData={fosterData} />
      <AccountSettingsForm currentEmail={currentEmail} authProvider={authProvider} />
    </div>
  )
}
