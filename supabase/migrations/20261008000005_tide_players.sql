-- Players: a second membership role. Players read lore marked player_safe or
-- public (filtered by the app when TIDE_PUBLIC_SCOPE=tiered); they can never
-- write. Every write policy and RPC still checks role = 'gm'.

alter table public.project_members drop constraint if exists project_members_role_check;
alter table public.project_members add constraint project_members_role_check check (role in ('gm', 'player'));

-- Members (GM or player) may read the project's published lore even when
-- public viewing is off.
create or replace function public.tide_is_member(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  );
$$;
grant execute on function public.tide_is_member(uuid) to authenticated;

create policy identities_member_read on public.record_identities for select to authenticated using (public.tide_is_member(project_id));
create policy releases_member_read on public.releases for select to authenticated using (public.tide_is_member(project_id));
create policy release_records_member_read on public.release_records for select to authenticated using (public.tide_is_member(project_id));
create policy projects_member_read on public.projects for select to authenticated using (public.tide_is_member(id));
