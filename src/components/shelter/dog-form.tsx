'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dog } from '@/types/database'
import { DOG_AGES, DOG_SIZES, DOG_GENDERS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

const dogSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  breed: z.string().optional(),
  age: z.enum(['puppy', 'young', 'adult', 'senior']).optional(),
  size: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  gender: z.enum(['male', 'female']).optional(),
  temperament: z.string().optional(),
  medical_status: z.string().optional(),
  special_needs: z.string().optional(),
  description: z.string().optional(),
})

type DogFormValues = z.infer<typeof dogSchema>

interface DogFormProps {
  mode: 'create' | 'edit'
  dogId?: string
  initialData?: Partial<Dog>
}

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

export function DogForm({ mode, dogId, initialData }: DogFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<DogFormValues>({
    resolver: zodResolver(dogSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      breed: initialData?.breed ?? '',
      age: initialData?.age ?? undefined,
      size: initialData?.size ?? undefined,
      gender: initialData?.gender ?? undefined,
      temperament: initialData?.temperament ?? '',
      medical_status: initialData?.medical_status ?? '',
      special_needs: initialData?.special_needs ?? '',
      description: initialData?.description ?? '',
    },
  })

  async function onSubmit(values: DogFormValues) {
    setSubmitError(null)

    if (DEV_MODE) {
      router.push('/shelter/dogs')
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitError('You must be logged in.'); return }

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!shelterRow) { setSubmitError('No shelter profile found.'); return }

    const payload = {
      ...values,
      breed: values.breed || null,
      age: values.age || null,
      size: values.size || null,
      gender: values.gender || null,
      temperament: values.temperament || null,
      medical_status: values.medical_status || null,
      special_needs: values.special_needs || null,
      description: values.description || null,
    }

    if (mode === 'create') {
      const { error } = await supabase.from('dogs').insert({
        shelter_id: shelterRow.id,
        photos: [],
        ...payload,
      })
      if (error) { setSubmitError(error.message); return }
    } else {
      const { error } = await supabase
        .from('dogs')
        .update(payload)
        .eq('id', dogId!)
      if (error) { setSubmitError(error.message); return }
    }

    router.push('/shelter/dogs')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{submitError}</p>
        )}
        {/* Photo Upload */}
        <div className="space-y-2">
          <Label>Photos (max 5)</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG up to 10MB each
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3">
              Choose Files
            </Button>
          </div>
          {/* TODO: render uploaded photo previews here */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dog Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Buddy" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="breed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Breed</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Labrador Mix" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select age range" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_AGES.map((age) => (
                      <SelectItem key={age} value={age} className="capitalize">
                        {age.charAt(0).toUpperCase() + age.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_SIZES.map((size) => (
                      <SelectItem key={size} value={size} className="capitalize">
                        {size === 'xl' ? 'XL' : size.charAt(0).toUpperCase() + size.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_GENDERS.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="temperament"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temperament</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the dog's personality and behavior..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="medical_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medical Status</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Vaccinated, spayed, heartworm negative..."
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="special_needs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Special Needs</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. No cats, needs medication twice daily..."
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell fosters everything they need to know about this dog..."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit">
            {mode === 'create' ? 'Add Dog' : 'Save Changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
