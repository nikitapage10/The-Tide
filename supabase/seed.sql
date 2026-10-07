-- Creates the single private project row. Run once after the migrations
-- (Supabase SQL editor, or `supabase db reset` locally, which runs seed.sql).
-- The UUID matches fixtures/ids.json so the seed publication bundle can be
-- imported unchanged. Set TIDE_PROJECT_ID to this value.
insert into public.projects (id, name)
values ('333ea628-f6a1-4f3a-8b83-ce98d12f2565', 'The Tide')
on conflict (id) do nothing;

-- Then grant yourself GM access AFTER signing in once (so auth.users has your row):
--   insert into public.project_members (project_id, user_id, role)
--   select '333ea628-f6a1-4f3a-8b83-ce98d12f2565', id, 'gm' from auth.users where email = 'you@example.com';
--
-- Lore is NOT seeded by SQL. Publish fixtures/publication/seed-release.json through
-- The Workshop → Publishing so it goes through the same validated release path.
