'use client'

/**
 * AccountSettingsForm — auth-level account management (email + password).
 *
 * Reused by both `/shelter/settings` and `/foster/profile`. Talks directly
 * to `supabase.auth.updateUser()` from the browser client; there is no
 * backing API route yet (Zod + rate-limiting will come with §28/§30).
 *
 * OAuth users (provider === 'google' etc.) can't change passwords locally
 * because Supabase manages the auth there, so the password card is hidden
 * for them. The email card is always available; Supabase sends a
 * confirmation link to the new address and only swaps the login once the
 * user clicks through.
 */

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { DEV_MODE } from '@/lib/constants'
import { describeAuthError } from '@/lib/auth-errors'

const MIN_PASSWORD_LENGTH = 8

interface AccountSettingsFormProps {
  /** Current auth.users.email for the signed-in user. */
  currentEmail: string
  /** OAuth provider, if any (e.g. 'google', 'email'). `null` for email/password. */
  authProvider: string | null
}

export function AccountSettingsForm({ currentEmail, authProvider }: AccountSettingsFormProps) {
  const supabase = createClient()

  // Email form
  const [newEmail, setNewEmail] = useState('')
  const [isChangingEmail, setIsChangingEmail] = useState(false)

  // Password form
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Delete-account confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const isOAuthUser = authProvider !== null && authProvider !== 'email'

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed) return
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error('New email matches your current email.')
      return
    }
    if (DEV_MODE) {
      toast.error('Account settings are disabled in DEV_MODE.')
      return
    }

    setIsChangingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setIsChangingEmail(false)

    if (error) {
      console.error('[account-settings] updateEmail failed:', error.message)
      toast.error(describeAuthError(error, 'Failed to update email. Please try again.'))
      return
    }
    toast.success(
      `Confirmation sent to ${trimmed}. Click the link in that email to finish the change.`,
    )
    setNewEmail('')
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }
    if (DEV_MODE) {
      toast.error('Account settings are disabled in DEV_MODE.')
      return
    }

    setIsChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setIsChangingPassword(false)

    if (error) {
      console.error('[account-settings] updatePassword failed:', error.message)
      toast.error(describeAuthError(error, 'Failed to update password. Please try again.'))
      return
    }
    toast.success('Password updated.')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleAccountDelete() {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Type DELETE to confirm.')
      return
    }
    if (DEV_MODE) {
      toast.error('Account deletion is disabled in DEV_MODE.')
      return
    }
    setIsDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(payload.error ?? 'Failed to delete account.')
        setIsDeleting(false)
        return
      }
      toast.success('Account deleted. Signing you out…')
      // Best-effort local cleanup; the server route already signed out the
      // cookie-bound client, but this also wipes the in-memory browser
      // client state before the hard nav.
      await supabase.auth.signOut().catch(() => undefined)
      window.location.href = '/'
    } catch {
      toast.error('Failed to delete account. Please try again.')
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Manage the email and password you sign in with.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <form onSubmit={handleEmailChange} className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-medium">Email</h3>
            <p className="text-sm text-muted-foreground">
              Currently signed in as <span className="font-medium">{currentEmail}</span>.
              {isOAuthUser && (
                <>
                  {' '}You&apos;re signed in with{' '}
                  <span className="capitalize">{authProvider}</span>; changing email here
                  updates how Fostr Find reaches you but not your {authProvider} account.
                </>
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll send a confirmation link to the new address. Your email won&apos;t
              change until you click it.
            </p>
          </div>
          <Button type="submit" disabled={isChangingEmail || !newEmail.trim()}>
            {isChangingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update email
          </Button>
        </form>

        {!isOAuthUser && (
          <>
            <Separator />
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1">
                <h3 className="font-medium">Password</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a new password. Must be at least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isChangingPassword || !newPassword}>
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Deleting your account cancels any active applications and
            anonymises your profile. Completed placements stay in
            history for audit purposes. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open)
              if (!open) setDeleteConfirmation('')
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete my account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately sign you out and remove your ability
                  to log in. Active applications will be marked as declined
                  so shelters / fosters you&apos;re connected with aren&apos;t
                  left hanging.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-sm">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="DELETE"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                  onClick={(e) => {
                    e.preventDefault()
                    void handleAccountDelete()
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
