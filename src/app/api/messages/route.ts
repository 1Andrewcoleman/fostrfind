import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeMultiline } from '@/lib/sanitize'
import { createNotification } from '@/lib/notifications'

const messageSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
})

interface MessageApplicationRow {
  id: string
  foster:
    | {
        id: string
        user_id: string
        first_name: string | null
        last_name: string | null
      }
    | null
  shelter:
    | {
        id: string
        user_id: string
        name: string | null
      }
    | null
}

interface MessageRow {
  id: string
  created_at: string
  application_id: string
  sender_id: string
  sender_role: 'foster' | 'shelter'
  body: string
  read: boolean
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim()
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[messages/create] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = rateLimit('messages:create', user.id, { limit: 30, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = messageSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select(
      'id, foster:foster_parents!inner(id, user_id, first_name, last_name), shelter:shelters!inner(id, user_id, name)',
    )
    .eq('id', parsed.data.applicationId)
    .single<MessageApplicationRow>()

  if (appError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const fosterUserId = application.foster?.user_id
  const shelterUserId = application.shelter?.user_id
  const isFoster = fosterUserId === user.id
  const isShelter = shelterUserId === user.id

  if (!isFoster && !isShelter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const senderRole: 'foster' | 'shelter' = isFoster ? 'foster' : 'shelter'
  const cleanedBody = sanitizeMultiline(parsed.data.body)

  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      application_id: parsed.data.applicationId,
      sender_id: user.id,
      sender_role: senderRole,
      body: cleanedBody,
      read: false,
    })
    .select()
    .single<MessageRow>()

  if (insertError || !message) {
    console.error('[messages/create] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  const recipientUserId = isFoster ? shelterUserId : fosterUserId
  if (recipientUserId) {
    const fosterName = fullName(application.foster?.first_name, application.foster?.last_name)
    const senderName = isFoster
      ? fosterName || 'A foster'
      : application.shelter?.name || 'A shelter'
    const recipientLink = isFoster
      ? `/shelter/messages/${parsed.data.applicationId}`
      : `/foster/messages/${parsed.data.applicationId}`

    void createNotification({
      userId: recipientUserId,
      type: 'new_message',
      title: `New message from ${senderName}`,
      body: cleanedBody.slice(0, 100),
      link: recipientLink,
      metadata: { applicationId: parsed.data.applicationId, messageId: message.id },
    })
  }

  return NextResponse.json(message, { status: 201 })
}
