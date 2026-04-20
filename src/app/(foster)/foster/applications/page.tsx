import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FosterApplicationsList } from '@/components/foster/applications-list'

export const metadata: Metadata = { title: 'My Applications' }
import { ServerErrorPanel } from '@/components/server-error-panel'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { ApplicationWithDetails } from '@/types/database'

export default async function FosterApplicationsPage(): Promise<React.JSX.Element> {
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
      if (!user) {
        redirect('/login')
      }

      const { data: fosterRow, error: fosterError } = await supabase
        .from('foster_parents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fosterError) throw fosterError
      if (!fosterRow) {
        redirect('/onboarding')
      }

      const { data, error } = await supabase
        .from('applications')
        .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
        .eq('foster_id', fosterRow.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      applications = (data ?? []) as ApplicationWithDetails[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[foster/applications] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Applications</h1>
      {fetchError ? (
        <ServerErrorPanel />
      ) : (
        <FosterApplicationsList applications={applications} />
      )}
    </div>
  )
}
