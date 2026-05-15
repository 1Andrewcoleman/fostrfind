import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getPostAuthDestination } from '@/lib/auth-routing'

export default async function NotFound() {
  let destination = '/'
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      destination = await getPostAuthDestination(supabase, user.id)
    }
  } catch {
    // If auth check fails, fall back to home
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-2xl font-bold mt-4 mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild>
        <Link href={destination}>
          {destination === '/' ? 'Back to Home' : 'Go to Dashboard'}
        </Link>
      </Button>
    </div>
  )
}
