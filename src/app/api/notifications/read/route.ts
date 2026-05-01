import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const readSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
])

export async function PATCH(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[notifications/read] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  return NextResponse.json({ success: true })
}
