import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FosterApplicationsList } from '@/components/foster/applications-list'
import { DEV_MODE } from '@/lib/constants'
import type { ApplicationWithDetails } from '@/types/database'

export default async function FosterApplicationsPage(): Promise<React.JSX.Element> {
  let applications: ApplicationWithDetails[] = []

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: fosterRow } = await supabase
      .from('foster_parents')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!fosterRow) {
      redirect('/onboarding')
    }

    const { data } = await supabase
      .from('applications')
      .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
      .eq('foster_id', fosterRow.id)
      .order('created_at', { ascending: false })

    applications = (data ?? []) as ApplicationWithDetails[]
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Applications</h1>
      <FosterApplicationsList applications={applications} />
    </div>
  )
}
