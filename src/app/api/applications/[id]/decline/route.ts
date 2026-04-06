// import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: 1. Verify caller is authenticated shelter owner of this application
  // const supabase = await createClient()

  // TODO: 2. Update application status → 'declined'
  // await supabase.from('applications').update({ status: 'declined' }).eq('id', params.id)

  // Note: dog status stays 'available' — it can receive more applications

  // TODO: 3. Send decline notification email
  // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
  //   method: 'POST',
  //   body: JSON.stringify({ type: 'application_declined', applicationId: params.id }),
  // })

  return NextResponse.json({ success: true, applicationId: params.id })
}
