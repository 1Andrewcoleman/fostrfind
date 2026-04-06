// import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: 1. Verify caller is authenticated
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // TODO: 2. Verify caller is shelter owner of this application
  // const { data: application } = await supabase
  //   .from('applications')
  //   .select('*, shelter:shelters(user_id), dog_id')
  //   .eq('id', params.id)
  //   .single()
  // if (application?.shelter.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // TODO: 3. Update application status → 'accepted'
  // await supabase.from('applications').update({ status: 'accepted' }).eq('id', params.id)

  // TODO: 4. Update dog status → 'pending'
  // await supabase.from('dogs').update({ status: 'pending' }).eq('id', application.dog_id)

  // TODO: 5. Send acceptance email via /api/notifications/send
  // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
  //   method: 'POST',
  //   body: JSON.stringify({ type: 'application_accepted', applicationId: params.id }),
  // })

  return NextResponse.json({ success: true, applicationId: params.id })
}
