import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiUser } from '@/lib/api-auth'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

const readSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
])

export async function PATCH(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  // Rate limit: 60/min is generous for normal notification management (click
  // "mark all read" a handful of times) while blocking scripted hammering,
  // especially the { all: true } path which triggers a full-table UPDATE.
  const auth = await requireApiUser('notifications/read', {
    key: 'notifications:read',
    limit: 60,
    windowMs: 60_000,
  })
  if (auth.response) return auth.response
  const { supabase, user } = auth

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = readSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Provide either { ids: string[] } or { all: true }' },
      { status: 422 },
    )
  }

  const now = new Date().toISOString()
  const update = { read: true, read_at: now }

  if ('all' in parsed.data) {
    const { error } = await supabase
      .from('notifications')
      .update(update)
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('[notifications/read] mark all read failed:', error.message)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('notifications')
      .update(update)
      .in('id', parsed.data.ids)
      .eq('user_id', user.id)

    if (error) {
      console.error('[notifications/read] mark selected read failed:', error.message)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }
  }

  return privateJson({ success: true })
}
