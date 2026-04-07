import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FosterProfileForm } from '@/components/foster/foster-profile-form'
import type { FosterParent } from '@/types/database'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

export default async function FosterProfilePage(): Promise<React.JSX.Element> {
  let fosterData: FosterParent | null = null

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data } = await supabase
      .from('foster_parents')
      .select('*')
      .eq('user_id', user.id)
      .single()

    fosterData = (data as FosterParent) ?? null
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <FosterProfileForm initialData={fosterData} />
    </div>
  )
}
