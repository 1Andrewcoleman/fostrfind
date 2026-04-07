'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface ShelterNoteEditorProps {
  applicationId: string
  initialNote: string | null
}

export function ShelterNoteEditor({ applicationId, initialNote }: ShelterNoteEditorProps) {
  const [note, setNote] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    setSaving(true)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('applications')
        .update({ shelter_note: note || null })
        .eq('id', applicationId)

      if (error) {
        toast.error('Failed to save note. Please try again.')
        return
      }

      toast.success('Note saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label>Internal Note</Label>
      <Textarea
        placeholder="Add a private note about this application (not visible to the foster)..."
        className="mt-1"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleSave}
        disabled={saving || note === (initialNote ?? '')}
      >
        {saving ? 'Saving...' : 'Save Note'}
      </Button>
    </div>
  )
}
