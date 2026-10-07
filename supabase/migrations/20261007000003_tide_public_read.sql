-- Optional public, read-only viewing of a project (requested by the GM).
--
-- When projects.public_read is true, anyone (signed in or not) may READ the
-- project's published lore and live status. Writing still requires GM
-- membership via the existing policies. GM notes and the publication audit
-- log are never public. Private storage stays private.
--
-- Turn it off at any time:
--   update public.projects set public_read = false where id = '<project id>';

alter table public.projects add column if not exists public_read boolean not null default false;

create or replace function public.tide_is_public(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.public_read from public.projects p where p.id = p_project_id), false);
$$;
grant execute on function public.tide_is_public(uuid) to anon, authenticated;

grant select on public.projects, public.record_identities, public.releases, public.release_records,
  public.session_states, public.checklist_items, public.print_jobs, public.print_attempts,
  public.builds, public.activity_events to anon;

create policy projects_public_read on public.projects for select to anon, authenticated using (public_read);
create policy identities_public_read on public.record_identities for select to anon, authenticated using (public.tide_is_public(project_id));
create policy releases_public_read on public.releases for select to anon, authenticated using (public.tide_is_public(project_id));
create policy release_records_public_read on public.release_records for select to anon, authenticated using (public.tide_is_public(project_id));
create policy session_states_public_read on public.session_states for select to anon, authenticated using (public.tide_is_public(project_id));
create policy checklist_public_read on public.checklist_items for select to anon, authenticated using (public.tide_is_public(project_id));
create policy print_jobs_public_read on public.print_jobs for select to anon, authenticated using (public.tide_is_public(project_id));
create policy print_attempts_public_read on public.print_attempts for select to anon, authenticated using (public.tide_is_public(project_id));
create policy builds_public_read on public.builds for select to anon, authenticated using (public.tide_is_public(project_id));
create policy activity_public_read on public.activity_events for select to anon, authenticated using (public.tide_is_public(project_id));

-- The Tide is public for now, at the GM's request.
update public.projects set public_read = true where id = '333ea628-f6a1-4f3a-8b83-ce98d12f2565';
