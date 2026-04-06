// import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // TODO: 1. Verify caller is authenticated shelter owner of this application
  // const supabase = await createClient()

  // TODO: 2. Update application status → 'completed'
  // await supabase.from('applications').update({ status: 'completed' }).eq('id', params.id)

  // TODO: 3. Update dog status → 'placed' (or 'adopted' for foster-to-adopt)
  // await supabase.from('dogs').update({ status: 'placed' }).eq('id', application.dog_id)

  // TODO: 4. Send completion notification email to foster
  // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/send`, {
  //   method: 'POST',
  //   body: JSON.stringify({ type: 'placement_completed', applicationId: params.id }),
  // })

  // TODO: 5. Return prompt for shelter to rate the foster
  return NextResponse.json({
    success: true,
    applicationId: params.id,
    promptRating: true,
  })
}
