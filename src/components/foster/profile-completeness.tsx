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

  // Tinted with the same peach surface used elsewhere for
  // "not-yet-done" states (e.g. application pending badges), so this
  // block reads as a gentle nudge rather than an alert. Tokens keep
  // it portable across the upcoming dark sweep.
  return (
    <div className="rounded-lg border border-peach/60 bg-peach/30 p-4 space-y-3 mb-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">
          Profile {percentage}% complete
        </span>
        <Link
          href="/foster/profile"
          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          Complete profile
        </Link>
      </div>
      <Progress value={percentage} className="h-1.5" />
      <p className="text-xs text-muted-foreground">
        A complete profile helps shelters trust you and speeds up approvals.
      </p>
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((f) => (
            <Link key={f.key} href="/foster/profile" className="contents">
              <Badge
                variant="outline"
                className="text-xs border-peach-foreground/30 bg-background/60 font-normal hover:bg-background cursor-pointer"
              >
                {f.label}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
