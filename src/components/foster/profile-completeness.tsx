'use client'

import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { FosterParent } from '@/types/database'

interface ProfileCompletenessProps {
  foster: Partial<FosterParent>
}

const PROFILE_FIELDS: { key: keyof FosterParent; label: string }[] = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'housing_type', label: 'Housing type' },
  { key: 'experience', label: 'Experience level' },
  { key: 'bio', label: 'Bio' },
  { key: 'avatar_url', label: 'Profile photo' },
]

export function ProfileCompleteness({ foster }: ProfileCompletenessProps) {
  const filled = PROFILE_FIELDS.filter((f) => {
    const val = foster[f.key]
    return val !== null && val !== undefined && val !== ''
  })
  const missing = PROFILE_FIELDS.filter((f) => !filled.find((x) => x.key === f.key))
  const percentage = Math.round((filled.length / PROFILE_FIELDS.length) * 100)

  if (percentage === 100) return null

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Profile {percentage}% complete</span>
        <Link href="/foster/profile" className="text-xs text-primary hover:underline">
          Complete profile
        </Link>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground">
        A complete profile helps shelters trust you and speeds up approvals.
      </p>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {missing.map((f) => (
            <Badge key={f.key} variant="outline" className="text-xs cursor-pointer hover:bg-accent">
              <Link href="/foster/profile">{f.label}</Link>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
