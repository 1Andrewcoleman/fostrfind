// import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { STORAGE_BUCKETS } from '@/lib/constants'

export async function POST(_request: Request) {
  // TODO: 1. Authenticate user
  // const supabase = await createClient()
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // TODO: 2. Parse FormData
  // const formData = await _request.formData()
  // const file = formData.get('file') as File
  // const shelterIdOrFosterId = formData.get('entityId') as string
  // const dogId = formData.get('dogId') as string | null
  // const uploadType = formData.get('type') as 'dog-photo' | 'shelter-logo' | 'foster-avatar'

  // TODO: 3. Client-side resize is preferred (browser canvas, max 1200px wide)
  //         but as a fallback, could use sharp here:
  //         import sharp from 'sharp'
  //         const buffer = await file.arrayBuffer()
  //         const resized = await sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).toBuffer()

  // TODO: 4. Determine upload path and bucket
  // const bucket = STORAGE_BUCKETS.DOG_PHOTOS
  // const path = `${shelterIdOrFosterId}/${dogId}/${Date.now()}-${file.name}`

  // TODO: 5. Upload to Supabase Storage
  // const { data, error } = await supabase.storage.from(bucket).upload(path, file)
  // if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)

  // Stub response
  return NextResponse.json({
    url: `https://placeholder.supabase.co/storage/v1/object/public/${STORAGE_BUCKETS.DOG_PHOTOS}/stub.jpg`,
  })
}
