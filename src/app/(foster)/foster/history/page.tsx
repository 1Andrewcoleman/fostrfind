import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'

export const metadata: Metadata = { title: 'Foster History' }
import { FosterHistoryCard } from '@/components/foster/foster-history-card'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { calculateAverageRating } from '@/lib/helpers'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type {
  ApplicationWithDetails,
  Rating,
  ShelterRating,
} from '@/types/database'

export default async function FosterHistoryPage(): Promise<React.JSX.Element> {
  let placements: ApplicationWithDetails[] = []
  const ratingsMap: Record<string, Rating | undefined> = {}
  const shelterRatingsMap: Record<string, ShelterRating | undefined> = {}
  let averageRating = 0
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

      const [applicationsResult, ratingsResult, shelterRatingsResult] = await Promise.all([
        supabase
          .from('applications')
          .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
          .eq('foster_id', fosterRow.id)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false }),
        supabase
          .from('ratings')
          .select('*')
          .eq('foster_id', fosterRow.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('shelter_ratings')
          .select('*')
          .eq('foster_id', fosterRow.id),
      ])

      if (applicationsResult.error || ratingsResult.error || shelterRatingsResult.error) {
        throw applicationsResult.error || ratingsResult.error || shelterRatingsResult.error
      }

      placements = (applicationsResult.data ?? []) as ApplicationWithDetails[]
      const allRatings = (ratingsResult.data ?? []) as Rating[]
      const allShelterRatings = (shelterRatingsResult.data ?? []) as ShelterRating[]

      for (const rating of allRatings) {
        ratingsMap[rating.application_id] = rating
      }
      for (const sr of allShelterRatings) {
        shelterRatingsMap[sr.application_id] = sr
      }

      averageRating = calculateAverageRating(allRatings)
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[foster/history] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  const totalPlacements = placements.length

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Foster History</h1>

      {fetchError && <ServerErrorPanel />}

      {/* Stats */}
      {!fetchError && totalPlacements > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{totalPlacements}</p>
            <p className="text-sm text-muted-foreground">Total Placements</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">
              {averageRating > 0 ? averageRating.toFixed(1) : '\u2014'}
            </p>
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </div>
        </div>
      )}

      {fetchError ? null : placements.length === 0 ? (
        <EmptyState
          title="No foster history yet"
          description="Your completed fosters will appear here. Each one makes a difference — keep going!"
          action={{ label: 'Browse Dogs', href: '/foster/browse' }}
        />
      ) : (
        <div className="space-y-3">
          {placements.map((placement) => (
            <FosterHistoryCard
              key={placement.id}
              application={placement}
              rating={ratingsMap[placement.id]}
              shelterRating={shelterRatingsMap[placement.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
