import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Home,
  Heart,
  PawPrint,
  Users,
  Clock3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE, DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { NoteForm } from '@/app/(shelter)/shelter/fosters/[fosterId]/note-form'
import { getInitials } from '@/lib/helpers'

interface PageProps {
  params: { fosterId: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (DEV_MODE) return { title: 'Foster' }
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('foster_parents')
      .select('first_name, last_name')
      .eq('id', params.fosterId)
      .maybeSingle()
    if (!data) return { title: 'Foster' }
    const row = data as { first_name: string | null; last_name: string | null }
    const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
    return { title: name || 'Foster' }
  } catch {
    return { title: 'Foster' }
  }
}

interface FosterPayload {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  location: string
  avatar_url: string | null
  bio: string | null
  housing_type: string | null
  has_yard: boolean
  has_other_pets: boolean
  has_children: boolean
  pref_size: string[]
  pref_age: string[]
  pref_medical: boolean
}

interface ApplicationRow {
  id: string
  created_at: string
  status: string
  dog: { id: string; name: string } | null
}

interface NoteRow {
  id: string
  created_at: string
  body: string
  author_user: string
}

export default async function ShelterFosterDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  if (DEV_MODE) {
    return (
      <ServerErrorPanel
        description="This page is only meaningful with live Supabase data. Connect a real backend to view roster entries."
      />
    )
  }

  let foster: FosterPayload | null = null
  let apps: ApplicationRow[] = []
  let notes: NoteRow[] = []
  let activeFosteringCount = 0
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!user) redirect('/login')

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!shelterRow) redirect('/onboarding')
    const shelterId = (shelterRow as { id: string }).id

    // Authorization: foster must be on the caller's roster. If not, 404
    // so existence of the foster_parents row isn't leaked.
    const { data: rosterRow } = await supabase
      .from('shelter_fosters')
      .select('shelter_id')
      .eq('shelter_id', shelterId)
      .eq('foster_id', params.fosterId)
      .maybeSingle()
    if (!rosterRow) notFound()

    const { data: fosterData, error: fosterErr } = await supabase
      .from('foster_parents')
      .select(
        'id, first_name, last_name, email, phone, location, avatar_url, bio, housing_type, has_yard, has_other_pets, has_children, pref_size, pref_age, pref_medical',
      )
      .eq('id', params.fosterId)
      .maybeSingle()
    if (fosterErr) throw fosterErr
    if (!fosterData) notFound()
    foster = fosterData as FosterPayload

    const { data: appRows } = await supabase
      .from('applications')
      .select('id, created_at, status, dog:dogs(id, name)')
      .eq('foster_id', params.fosterId)
      .eq('shelter_id', shelterId)
      .order('created_at', { ascending: false })
    apps = (appRows ?? []) as unknown as ApplicationRow[]

    const { count } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('foster_id', params.fosterId)
      .eq('status', 'accepted')
    activeFosteringCount = count ?? 0

    const { data: noteRows } = await supabase
      .from('shelter_foster_notes')
      .select('id, created_at, body, author_user')
      .eq('shelter_id', shelterId)
      .eq('foster_id', params.fosterId)
      .order('created_at', { ascending: false })
      .limit(50)
    notes = (noteRows ?? []) as NoteRow[]
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error(
      '[shelter/fosters/detail] load failed:',
      e instanceof Error ? e.message : String(e),
    )
    fetchError = true
  }

  if (fetchError) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Back />
        <ServerErrorPanel />
      </div>
    )
  }

  if (!foster) notFound()

  const fullName = `${foster.first_name} ${foster.last_name}`.trim() || foster.email

  return (
    <div className="space-y-6 max-w-3xl">
      <Back />

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          {foster.avatar_url ? <AvatarImage src={foster.avatar_url} alt={fullName} /> : null}
          <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold truncate">{fullName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {foster.email}
            </span>
            {foster.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {foster.phone}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {foster.location}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Heart className="h-3 w-3" />
              {activeFosteringCount > 0
                ? `Currently fostering ${activeFosteringCount}`
                : 'Not currently fostering'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Home / Preferences */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold">Home &amp; preferences</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow icon={Home} label="Housing">
            {foster.housing_type ?? 'Not provided'}
            {foster.has_yard && ' · yard'}
          </DetailRow>
          <DetailRow icon={PawPrint} label="Other pets">
            {foster.has_other_pets ? 'Yes' : 'No'}
          </DetailRow>
          <DetailRow icon={Users} label="Children">
            {foster.has_children ? 'Yes' : 'No'}
          </DetailRow>
          <DetailRow icon={Heart} label="Preferences">
            {formatPreferences(foster)}
          </DetailRow>
        </div>
        {foster.bio && (
          <div className="pt-3 border-t text-sm">
            <h3 className="font-semibold mb-1">About</h3>
            <p className="whitespace-pre-wrap text-muted-foreground">{foster.bio}</p>
          </div>
        )}
      </Card>

      {/* Interaction history */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold">Interaction history with your shelter</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past applications yet.</p>
        ) : (
          <ul className="divide-y -mx-2">
            {apps.map((app) => (
              <li key={app.id} className="px-2 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {app.dog?.name ?? 'Unknown dog'}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    {new Date(app.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {app.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Private notes */}
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Private notes</h2>
          <p className="text-xs text-muted-foreground">
            Only visible to your shelter. The foster never sees these.
          </p>
        </div>
        <NoteForm fosterId={foster.id} />
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-3 pt-1">
            {notes.map((note) => (
              <li key={note.id} className="rounded-md border p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Back() {
  return (
    <Link
      href="/shelter/fosters"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to fosters
    </Link>
  )
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

function formatPreferences(foster: FosterPayload): string {
  const parts: string[] = []
  if (foster.pref_size.length > 0) {
    parts.push(
      `Size: ${foster.pref_size
        .map((s) => DOG_SIZE_LABELS[s as keyof typeof DOG_SIZE_LABELS] ?? s)
        .join(', ')}`,
    )
  }
  if (foster.pref_age.length > 0) {
    parts.push(
      `Age: ${foster.pref_age
        .map((a) => DOG_AGE_LABELS[a as keyof typeof DOG_AGE_LABELS] ?? a)
        .join(', ')}`,
    )
  }
  if (foster.pref_medical) parts.push('OK with medical needs')
  return parts.length > 0 ? parts.join(' · ') : 'None specified'
}
