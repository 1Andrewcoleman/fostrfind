import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShelterSettingsForm } from '@/components/shelter/shelter-settings-form'
import { DEV_MODE } from '@/lib/constants'
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

  if (DEV_MODE) {
    shelterData = DEV_SHELTER
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data } = await supabase
      .from('shelters')
      .select('*')
      .eq('user_id', user.id)
      .single()

    shelterData = (data as Shelter) ?? null
  }

  if (!shelterData) {
    redirect('/onboarding')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ShelterSettingsForm initialData={shelterData} />
    </div>
  )
}
