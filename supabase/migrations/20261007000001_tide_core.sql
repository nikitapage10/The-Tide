-- The Tide — core schema, Row Level Security and publication functions.
--
-- Ownership boundary enforced here:
--   * Published tables (record_identities, releases, release_records,
--     publication_events) have NO insert/update/delete grants for API roles.
--     They change only through tide_commit_release (SECURITY DEFINER), which
--     re-checks GM membership and never touches operational tables.
--   * Operational tables (session_states, checklist_items, gm_notes,
--     print_jobs, print_attempts, builds, activity_events) have no columns for
--     source-owned fields, reference stable identities only, and never cascade.
--   * Every row is scoped by project_id; RLS requires GM membership.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ identity

create table public.projects (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 200),
  active_release_id uuid,
  release_count integer not null default 0 check (release_count >= 0),
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('gm')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.record_identities (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  record_type text not null check (record_type in ('entity','story','story_part','session','relationship','media','source','open_question')),
  first_release_id uuid not null,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (id, record_type)
);

-- ------------------------------------------------------------ published (immutable)

create table public.releases (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  version integer not null check (version > 0),
  kind text not null check (kind in ('publish','rollback')),
  base_release_id uuid,
  rollback_of_release_id uuid references public.releases(id),
  bundle_hash text not null,
  schema_version text not null,
  created_at timestamptz not null,
  published_at timestamptz not null default now(),
  published_by jsonb not null,
  title text,
  notes text,
  counts jsonb not null,
  unique (project_id, version),
  unique (project_id, id)
);

alter table public.projects
  add constraint projects_active_release_fk foreign key (id, active_release_id)
  references public.releases(project_id, id) deferrable initially deferred;

create table public.release_records (
  release_id uuid not null references public.releases(id) on delete restrict,
  record_id uuid not null,
  project_id uuid not null,
  record_type text not null,
  lifecycle text not null check (lifecycle in ('active','archived','tombstoned')),
  data jsonb,
  tombstone jsonb,
  content_hash text,
  introduced_in uuid not null,
  changed_in uuid not null,
  primary key (release_id, record_id),
  foreign key (project_id, record_id) references public.record_identities(project_id, id) on delete restrict,
  foreign key (record_id, record_type) references public.record_identities(id, record_type),
  check ((lifecycle = 'tombstoned') = (data is null))
);
create index release_records_project_idx on public.release_records(project_id, release_id);

create table public.publication_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  at timestamptz not null default now(),
  release_id uuid,
  outcome text not null check (outcome in ('applied','replayed','rejected')),
  code text,
  actor jsonb not null,
  counts jsonb
);
create index publication_events_project_idx on public.publication_events(project_id, at desc);

-- Published history is append-only, even for the table owner path.
create or replace function public.tide_forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'published history is immutable (%.%)', tg_table_schema, tg_table_name using errcode = '42501';
end $$;

create trigger releases_immutable before update or delete on public.releases
  for each row execute function public.tide_forbid_mutation();
create trigger release_records_immutable before update or delete on public.release_records
  for each row execute function public.tide_forbid_mutation();
create trigger record_identities_immutable before update or delete on public.record_identities
  for each row execute function public.tide_forbid_mutation();
create trigger publication_events_immutable before update or delete on public.publication_events
  for each row execute function public.tide_forbid_mutation();

-- ------------------------------------------------------------ operational (live)

create table public.session_states (
  session_id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  session_type text generated always as ('session') stored,
  status text not null default 'planned' check (status in ('planned','scheduled','in_progress','completed','postponed','canceled')),
  scheduled_for date,
  actual_run_date date,
  revision integer not null default 1 check (revision > 0),
  demo boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (project_id, session_id) references public.record_identities(project_id, id) on delete restrict,
  foreign key (session_id, session_type) references public.record_identities(id, record_type)
);

create table public.checklist_items (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  subject_id uuid not null,
  label text not null check (char_length(label) between 1 and 300),
  done boolean not null default false,
  sort_order integer not null default 0,
  revision integer not null default 1 check (revision > 0),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, subject_id) references public.record_identities(project_id, id) on delete restrict
);
create index checklist_subject_idx on public.checklist_items(project_id, subject_id);

create table public.gm_notes (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  subject_id uuid not null,
  body text not null check (char_length(body) between 1 and 10000),
  demo boolean not null default false,
  author_id uuid default auth.uid(),
  author_label text not null,
  created_at timestamptz not null default now(),
  foreign key (project_id, subject_id) references public.record_identities(project_id, id) on delete restrict
);
create index gm_notes_subject_idx on public.gm_notes(project_id, subject_id);

create table public.print_jobs (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  file_reference text,
  file_format text,
  printer_profile text,
  material text,
  scale text,
  dimensions jsonb,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes integer check (actual_minutes is null or actual_minutes >= 0),
  requested_quantity integer not null check (requested_quantity between 1 and 10000),
  completed_quantity integer not null default 0 check (completed_quantity >= 0),
  failed_quantity integer not null default 0 check (failed_quantity >= 0),
  status text not null default 'planned' check (status in ('planned','ready','printing','post_processing','complete','blocked','canceled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  notes text,
  linked_record_ids uuid[] not null default '{}',
  revision integer not null default 1 check (revision > 0),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_quantity <= requested_quantity),
  check (status <> 'complete' or completed_quantity = requested_quantity)
);

create table public.print_attempts (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  print_job_id uuid not null references public.print_jobs(id) on delete restrict,
  outcome text not null check (outcome in ('succeeded','failed')),
  quantity integer not null check (quantity between 1 and 10000),
  note text,
  recorded_at timestamptz not null default now()
);

create table public.builds (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (category in ('physical','code','logic','dashboard','other')),
  purpose text,
  status text not null default 'idea' check (status in ('idea','planned','in_progress','paused','done','abandoned')),
  links jsonb not null default '[]',
  versions jsonb not null default '[]',
  notes text,
  linked_record_ids uuid[] not null default '{}',
  revision integer not null default 1 check (revision > 0),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_events (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete restrict,
  at timestamptz not null default now(),
  kind text not null,
  summary text not null check (char_length(summary) <= 500),
  subject_id uuid,
  actor_label text not null,
  demo boolean not null default false
);
create index activity_project_idx on public.activity_events(project_id, at desc);

-- Linked IDs must be stable identities in the same project.
create or replace function public.tide_check_linked_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.linked_record_ids) as l(id)
    where not exists (select 1 from public.record_identities r where r.id = l.id and r.project_id = new.project_id)
  ) then
    raise exception 'linked_record_ids must reference records in the same project' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger print_jobs_links before insert or update on public.print_jobs
  for each row execute function public.tide_check_linked_ids();
create trigger builds_links before insert or update on public.builds
  for each row execute function public.tide_check_linked_ids();

-- Checklist subjects must be sessions or stories.
create or replace function public.tide_check_checklist_subject() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.record_identities r
                 where r.id = new.subject_id and r.project_id = new.project_id and r.record_type in ('session','story')) then
    raise exception 'checklist subject must be a session or story' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger checklist_subject before insert or update on public.checklist_items
  for each row execute function public.tide_check_checklist_subject();

-- Optimistic concurrency + immutable identity columns on live rows.
create or replace function public.tide_live_update_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'revision must increase by exactly 1 (expected %, got %)', old.revision + 1, new.revision using errcode = '40001';
  end if;
  if (to_jsonb(new) ->> 'project_id') is distinct from (to_jsonb(old) ->> 'project_id')
     or (to_jsonb(new) ->> 'demo') is distinct from (to_jsonb(old) ->> 'demo')
     or (to_jsonb(new) ->> 'id') is distinct from (to_jsonb(old) ->> 'id')
     or (to_jsonb(new) ->> 'session_id') is distinct from (to_jsonb(old) ->> 'session_id')
     or (to_jsonb(new) ->> 'subject_id') is distinct from (to_jsonb(old) ->> 'subject_id') then
    raise exception 'identity columns are immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger session_states_guard before update on public.session_states for each row execute function public.tide_live_update_guard();
create trigger checklist_items_guard before update on public.checklist_items for each row execute function public.tide_live_update_guard();
create trigger print_jobs_guard before update on public.print_jobs for each row execute function public.tide_live_update_guard();
create trigger builds_guard before update on public.builds for each row execute function public.tide_live_update_guard();

-- Append-only live logs.
create trigger gm_notes_append_only before update or delete on public.gm_notes for each row execute function public.tide_forbid_mutation();
create trigger print_attempts_append_only before update or delete on public.print_attempts for each row execute function public.tide_forbid_mutation();
create trigger activity_append_only before update or delete on public.activity_events for each row execute function public.tide_forbid_mutation();

-- ------------------------------------------------------------ authorization helpers

create or replace function public.tide_is_gm(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid() and m.role = 'gm'
  );
$$;

create or replace function public.tide_is_service_role() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function public.tide_try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ------------------------------------------------------------ RLS

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.record_identities enable row level security;
alter table public.releases enable row level security;
alter table public.release_records enable row level security;
alter table public.publication_events enable row level security;
alter table public.session_states enable row level security;
alter table public.checklist_items enable row level security;
alter table public.gm_notes enable row level security;
alter table public.print_jobs enable row level security;
alter table public.print_attempts enable row level security;
alter table public.builds enable row level security;
alter table public.activity_events enable row level security;

-- Private app: anonymous users get nothing.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;

-- Published tables: read-only for API roles.
revoke insert, update, delete, truncate on public.projects, public.project_members, public.record_identities,
  public.releases, public.release_records, public.publication_events from authenticated;
-- Append-only live logs: no update/delete.
revoke update, delete, truncate on public.gm_notes, public.print_attempts, public.activity_events from authenticated;
revoke truncate on public.session_states, public.checklist_items, public.print_jobs, public.builds from authenticated;
revoke delete on public.session_states, public.print_jobs, public.builds from authenticated;

create policy projects_gm_read on public.projects for select to authenticated using (public.tide_is_gm(id));
create policy members_self_read on public.project_members for select to authenticated using (user_id = auth.uid());
create policy identities_gm_read on public.record_identities for select to authenticated using (public.tide_is_gm(project_id));
create policy releases_gm_read on public.releases for select to authenticated using (public.tide_is_gm(project_id));
create policy release_records_gm_read on public.release_records for select to authenticated using (public.tide_is_gm(project_id));
create policy publication_events_gm_read on public.publication_events for select to authenticated using (public.tide_is_gm(project_id));

create policy session_states_gm_read on public.session_states for select to authenticated using (public.tide_is_gm(project_id));
create policy session_states_gm_insert on public.session_states for insert to authenticated with check (public.tide_is_gm(project_id));
create policy session_states_gm_update on public.session_states for update to authenticated using (public.tide_is_gm(project_id)) with check (public.tide_is_gm(project_id));

create policy checklist_gm_read on public.checklist_items for select to authenticated using (public.tide_is_gm(project_id));
create policy checklist_gm_insert on public.checklist_items for insert to authenticated with check (public.tide_is_gm(project_id));
create policy checklist_gm_update on public.checklist_items for update to authenticated using (public.tide_is_gm(project_id)) with check (public.tide_is_gm(project_id));
create policy checklist_gm_delete on public.checklist_items for delete to authenticated using (public.tide_is_gm(project_id));

create policy gm_notes_gm_read on public.gm_notes for select to authenticated using (public.tide_is_gm(project_id));
create policy gm_notes_gm_insert on public.gm_notes for insert to authenticated with check (public.tide_is_gm(project_id) and author_id = auth.uid());

create policy print_jobs_gm_read on public.print_jobs for select to authenticated using (public.tide_is_gm(project_id));
create policy print_jobs_gm_insert on public.print_jobs for insert to authenticated with check (public.tide_is_gm(project_id));
create policy print_jobs_gm_update on public.print_jobs for update to authenticated using (public.tide_is_gm(project_id)) with check (public.tide_is_gm(project_id));

create policy print_attempts_gm_read on public.print_attempts for select to authenticated using (public.tide_is_gm(project_id));
create policy print_attempts_gm_insert on public.print_attempts for insert to authenticated with check (
  public.tide_is_gm(project_id)
  and exists (select 1 from public.print_jobs j where j.id = print_job_id and j.project_id = print_attempts.project_id)
);

create policy builds_gm_read on public.builds for select to authenticated using (public.tide_is_gm(project_id));
create policy builds_gm_insert on public.builds for insert to authenticated with check (public.tide_is_gm(project_id));
create policy builds_gm_update on public.builds for update to authenticated using (public.tide_is_gm(project_id)) with check (public.tide_is_gm(project_id));

create policy activity_gm_read on public.activity_events for select to authenticated using (public.tide_is_gm(project_id));
create policy activity_gm_insert on public.activity_events for insert to authenticated with check (public.tide_is_gm(project_id));

-- ------------------------------------------------------------ publication functions

-- Atomic release commit. Called by the app's PublicationService after it has
-- validated the bundle and materialized the full snapshot. Re-checks, under a
-- row lock: authorization, idempotency (release id + hash), base release (CAS).
-- Writes ONLY publication tables. Any error rolls back the whole call.
create or replace function public.tide_commit_release(p_project_id uuid, p_release jsonb, p_records jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_project public.projects%rowtype;
  v_existing public.releases%rowtype;
  v_release public.releases%rowtype;
  v_release_id uuid := (p_release ->> 'id')::uuid;
  v_actor jsonb;
  v_bad integer;
begin
  if not (public.tide_is_gm(p_project_id) or public.tide_is_service_role()) then
    raise exception 'not authorized to publish for this project' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.releases where id = v_release_id;
  if found then
    if v_existing.project_id = p_project_id and v_existing.bundle_hash = p_release ->> 'bundleHash' then
      return jsonb_build_object('status', 'replayed', 'release', public.tide_release_json(v_existing));
    end if;
    return jsonb_build_object('status', 'conflict', 'code', 'RELEASE_ID_CONFLICT', 'activeReleaseId', v_project.active_release_id);
  end if;

  if v_project.active_release_id is distinct from (p_release ->> 'baseReleaseId')::uuid then
    return jsonb_build_object('status', 'conflict', 'code', 'STALE_BASE', 'activeReleaseId', v_project.active_release_id);
  end if;

  -- The actor is derived from the authenticated caller, not trusted from the payload.
  v_actor := case
    when public.tide_is_service_role() then jsonb_build_object('kind', 'machine', 'id', 'machine-publisher', 'label', 'Machine publisher')
    else jsonb_build_object('kind', 'user', 'id', auth.uid()::text, 'label', coalesce(auth.jwt() ->> 'email', 'GM'))
  end;

  insert into public.releases (id, project_id, version, kind, base_release_id, rollback_of_release_id, bundle_hash,
    schema_version, created_at, published_at, published_by, title, notes, counts)
  values (
    v_release_id, p_project_id, v_project.release_count + 1, p_release ->> 'kind',
    (p_release ->> 'baseReleaseId')::uuid, (p_release ->> 'rollbackOfReleaseId')::uuid, p_release ->> 'bundleHash',
    p_release ->> 'schemaVersion', (p_release ->> 'createdAt')::timestamptz, now(), v_actor,
    p_release ->> 'title', p_release ->> 'notes', p_release -> 'counts'
  ) returning * into v_release;

  -- Register any new stable identities; existing ones must match project and type.
  insert into public.record_identities (id, project_id, record_type, first_release_id)
  select (r ->> 'id')::uuid, p_project_id, r ->> 'type', v_release_id
  from jsonb_array_elements(p_records) r
  on conflict (id) do nothing;

  select count(*) into v_bad
  from jsonb_array_elements(p_records) r
  join public.record_identities i on i.id = (r ->> 'id')::uuid
  where i.project_id <> p_project_id or i.record_type <> r ->> 'type';
  if v_bad > 0 then
    raise exception 'record identity belongs to another project or type' using errcode = '23514';
  end if;

  insert into public.release_records (release_id, record_id, project_id, record_type, lifecycle, data, tombstone,
    content_hash, introduced_in, changed_in)
  select v_release_id, (r ->> 'id')::uuid, p_project_id, r ->> 'type', r ->> 'lifecycle',
    case when jsonb_typeof(r -> 'record') = 'object' then r -> 'record' else null end,
    case when jsonb_typeof(r -> 'tombstone') = 'object' then r -> 'tombstone' else null end,
    r ->> 'contentHash', (r ->> 'introducedIn')::uuid, (r ->> 'changedIn')::uuid
  from jsonb_array_elements(p_records) r;

  update public.projects set active_release_id = v_release_id, release_count = v_release.version where id = p_project_id;

  insert into public.publication_events (project_id, release_id, outcome, code, actor, counts)
  values (p_project_id, v_release_id, 'applied', null, v_actor, p_release -> 'counts');

  return jsonb_build_object('status', 'applied', 'release', public.tide_release_json(v_release));
end $$;

create or replace function public.tide_release_json(r public.releases) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id, 'projectId', r.project_id, 'version', r.version, 'kind', r.kind,
    'baseReleaseId', r.base_release_id, 'rollbackOfReleaseId', r.rollback_of_release_id,
    'bundleHash', r.bundle_hash, 'schemaVersion', r.schema_version,
    'createdAt', r.created_at, 'publishedAt', r.published_at, 'publishedBy', r.published_by,
    'title', r.title, 'notes', r.notes, 'counts', r.counts);
$$;

-- Audit entries for rejected/replayed attempts (applied ones are written by tide_commit_release).
create or replace function public.tide_record_publication_event(p_project_id uuid, p_release_id uuid, p_outcome text, p_code text, p_counts jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.tide_is_gm(p_project_id) or public.tide_is_service_role()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_outcome not in ('replayed', 'rejected') then
    raise exception 'invalid outcome' using errcode = '22023';
  end if;
  insert into public.publication_events (project_id, release_id, outcome, code, actor, counts)
  values (p_project_id, p_release_id, p_outcome, left(p_code, 64),
    case when public.tide_is_service_role() then jsonb_build_object('kind', 'machine', 'id', 'machine-publisher', 'label', 'Machine publisher')
         else jsonb_build_object('kind', 'user', 'id', auth.uid()::text, 'label', coalesce(auth.jwt() ->> 'email', 'GM')) end,
    p_counts);
end $$;

-- Atomic print attempt: CAS update of the job counters + append the attempt.
-- SECURITY INVOKER so RLS applies exactly as for direct writes.
create or replace function public.tide_record_print_attempt(
  p_job_id uuid, p_expected_revision integer, p_completed integer, p_failed integer,
  p_attempt_id uuid, p_outcome text, p_quantity integer, p_note text)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_job public.print_jobs%rowtype;
begin
  update public.print_jobs
     set completed_quantity = p_completed, failed_quantity = p_failed, revision = p_expected_revision + 1
   where id = p_job_id and revision = p_expected_revision
  returning * into v_job;
  if not found then
    if exists (select 1 from public.print_jobs where id = p_job_id) then
      return jsonb_build_object('status', 'conflict');
    end if;
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.print_attempts (id, project_id, print_job_id, outcome, quantity, note)
  values (p_attempt_id, v_job.project_id, p_job_id, p_outcome, p_quantity, p_note);
  return jsonb_build_object('status', 'ok');
end $$;

grant execute on function public.tide_is_gm(uuid) to authenticated;
grant execute on function public.tide_commit_release(uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.tide_record_publication_event(uuid, uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.tide_record_print_attempt(uuid, integer, integer, integer, uuid, text, integer, text) to authenticated;

-- Realtime: intentionally not enabled for any table in the MVP (the UI refetches after each change).
