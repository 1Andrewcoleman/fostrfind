-- Enable Supabase Realtime for the `messages` table.
--
-- The client (`MessageThread`) subscribes to the `messages:<application_id>`
-- channel and listens for `postgres_changes` INSERT events. Without this
-- publication entry, Supabase emits no events and the subscription is silent.
--
-- Safe to run multiple times: `add table` errors if the table is already in
-- the publication, so we wrap in a DO block that swallows the specific
-- "already member" error.

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when others then
    -- re-raise anything that isn't "relation is already member of publication"
    if sqlerrm not like '%already member%' then
      raise;
    end if;
end
$$;
