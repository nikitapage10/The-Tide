-- GM invites: an email can be granted GM before that person has ever signed in.
-- On their first sign-in (row created in auth.users) the membership is added
-- automatically. Invites are written only by the database owner (e.g. the
-- "Supabase migrations" GitHub Action); API roles cannot read or write them.

create table if not exists public.project_invites (
  project_id uuid not null references public.projects(id) on delete restrict,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role text not null default 'gm' check (role in ('gm')),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);
alter table public.project_invites enable row level security;
revoke all on public.project_invites from anon, authenticated;

create or replace function public.tide_apply_invites() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_members (project_id, user_id, role)
  select i.project_id, new.id, i.role
  from public.project_invites i
  where i.email = lower(new.email)
  on conflict (project_id, user_id) do nothing;
  return new;
end $$;
revoke all on function public.tide_apply_invites() from public, anon, authenticated;

drop trigger if exists tide_apply_invites on auth.users;
create trigger tide_apply_invites after insert or update of email on auth.users
  for each row execute function public.tide_apply_invites();
