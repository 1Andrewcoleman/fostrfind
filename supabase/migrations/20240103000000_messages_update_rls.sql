-- Allow application participants to mark messages as read.
--
-- The existing message policies (from 20240102000000) cover SELECT and INSERT
-- but not UPDATE. Thread-page server components mark incoming messages as
-- read on open, which requires an UPDATE policy.
--
-- We reuse the get_my_shelter_ids / get_my_foster_ids SECURITY DEFINER
-- helpers to avoid the recursive RLS issue documented in 20240102000000.

CREATE POLICY "messages: participants can mark as read"
  ON public.messages FOR UPDATE
  USING (
    application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  )
  WITH CHECK (
    application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  );
