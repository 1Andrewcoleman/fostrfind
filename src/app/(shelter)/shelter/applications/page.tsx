import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShelterApplicationsList } from '@/components/shelter/applications-list'

export const metadata: Metadata = { title: 'Applications' }
import { ServerErrorPanel } from '@/components/server-error-panel'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { ApplicationWithDetails } from '@/types/database'

export default async function ShelterApplicationsPage(): Promise<React.JSX.Element> {
  let applications: ApplicationWithDetails[] = []
  let fetchError = false

  if (!DEV_MODE) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) redirect('/login')

      const { data: shelterRow, error: shelterError } = await supabase
        .from('shelters')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (shelterError) throw shelterError
      if (!shelterRow) redirect('/onboarding')

      const { data, error } = await supabase
        .from('applications')
        .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
        .eq('shelter_id', shelterRow.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      applications = (data ?? []) as ApplicationWithDetails[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[shelter/applications] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      {fetchError ? <ServerErrorPanel /> : <ShelterApplicationsList applications={applications} />}
    </div>
  )
}
