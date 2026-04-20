import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShelterApplicationsList } from '@/components/shelter/applications-list'
import { DEV_MODE } from '@/lib/constants'
import type { ApplicationWithDetails } from '@/types/database'

export default async function ShelterApplicationsPage(): Promise<React.JSX.Element> {
  let applications: ApplicationWithDetails[] = []

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) throw authError
    if (!user) {
      redirect('/login')
    }

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!shelterRow) {
      redirect('/onboarding')
    }

    const { data } = await supabase
      .from('applications')
      .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
      .eq('shelter_id', shelterRow.id)
      .order('created_at', { ascending: false })

    applications = (data ?? []) as ApplicationWithDetails[]
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <ShelterApplicationsList applications={applications} />
    </div>
  )
}
