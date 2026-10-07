-- RLS, ownership-boundary and publication-function tests.
-- Each check prints "ok - …" or "not ok - …" (collected by scripts/test-db.sh).
\set QUIET on
set client_min_messages = notice;

-- ---------------------------------------------------------------- fixtures (superuser)
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'gm-a@example.test'),
  ('00000000-0000-4000-8000-0000000000b1', 'gm-b@example.test'),
  ('00000000-0000-4000-8000-0000000000c1', 'outsider@example.test');
insert into public.projects (id, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Project A'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Project B');
insert into public.project_members (project_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'gm'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'gm');
insert into storage.objects (bucket_id, name) values
  ('tide-private', 'aaaaaaaa-0000-4000-8000-000000000001/art/a.png'),
  ('tide-private', 'bbbbbbbb-0000-4000-8000-000000000001/art/b.png');

create schema tests;
grant usage on schema tests to authenticated, service_role, anon;
create function tests.claims(p_sub text, p_role text default 'authenticated', p_email text default null) returns void
language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_sub, 'role', p_role, 'email', p_email)::text, false);
$$;
grant execute on function tests.claims(text, text, text) to authenticated, service_role, anon;

-- Snapshot builder: one story, one session, one entity (ids fixed).
create function tests.snapshot(p_release uuid, p_entity_title text, p_session_lifecycle text default 'active', p_entity_type text default 'entity')
returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('id','11111111-0000-4000-8000-000000000001','type','story','lifecycle','active',
      'record', jsonb_build_object('id','11111111-0000-4000-8000-000000000001','type','story','title','Story','format','campaign'),
      'tombstone', null,'contentHash','sha256:s','introducedIn',p_release,'changedIn',p_release),
    jsonb_build_object('id','11111111-0000-4000-8000-000000000002','type','session','lifecycle',p_session_lifecycle,
      'record', jsonb_build_object('id','11111111-0000-4000-8000-000000000002','type','session','title','Session','storyId','11111111-0000-4000-8000-000000000001'),
      'tombstone', null,'contentHash','sha256:x','introducedIn',p_release,'changedIn',p_release),
    jsonb_build_object('id','11111111-0000-4000-8000-000000000003','type',p_entity_type,'lifecycle','active',
      'record', jsonb_build_object('id','11111111-0000-4000-8000-000000000003','type',p_entity_type,'title',p_entity_title,'kind','people'),
      'tombstone', null,'contentHash','sha256:' || md5(p_entity_title),'introducedIn',p_release,'changedIn',p_release));
$$;
grant execute on function tests.snapshot(uuid, text, text, text) to authenticated, service_role;

create function tests.release(p_id uuid, p_base uuid, p_hash text, p_kind text default 'publish') returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'kind', p_kind, 'baseReleaseId', p_base, 'rollbackOfReleaseId', null,
    'bundleHash', p_hash, 'schemaVersion', 'tide.publication.v1', 'createdAt', '2026-10-07T00:00:00Z',
    'title', 'test', 'notes', null, 'counts', '{"added":3}'::jsonb,
    'publishedBy', jsonb_build_object('kind','user','id','forged','label','Forged label'));
$$;
grant execute on function tests.release(uuid, uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------- anonymous
set role anon;
select tests.claims('', 'anon');
do $$ begin
  perform 1 from public.projects;
  raise notice 'not ok - anon can read projects';
exception when insufficient_privilege then raise notice 'ok - anon cannot read projects';
end $$;
do $$ begin
  perform public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001', '{}'::jsonb, '[]'::jsonb);
  raise notice 'not ok - anon can call tide_commit_release';
exception when insufficient_privilege then raise notice 'ok - anon cannot call tide_commit_release';
end $$;
reset role;

-- ---------------------------------------------------------------- GM A publishes
set role authenticated;
select tests.claims('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'gm-a@example.test');
do $$
declare r jsonb;
begin
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000001', null, 'sha256:r1'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000001', 'Teruānga'));
  if r ->> 'status' = 'applied' and (r -> 'release' ->> 'version')::int = 1 then raise notice 'ok - GM publishes first release (version 1)';
  else raise notice 'not ok - first publish: %', r; end if;
  if r -> 'release' -> 'publishedBy' ->> 'label' = 'gm-a@example.test' then raise notice 'ok - publishedBy is derived from the caller, not the payload';
  else raise notice 'not ok - publishedBy trusted from payload: %', r -> 'release' -> 'publishedBy'; end if;
end $$;

do $$
declare r jsonb;
begin
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000001', null, 'sha256:r1'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000001', 'Teruānga'));
  if r ->> 'status' = 'replayed' and (r -> 'release' ->> 'version')::int = 1 then raise notice 'ok - identical retry is idempotent (replayed, same version)';
  else raise notice 'not ok - retry: %', r; end if;
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000001', null, 'sha256:DIFFERENT'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000001', 'Other'));
  if r ->> 'code' = 'RELEASE_ID_CONFLICT' then raise notice 'ok - same release id with different content is rejected';
  else raise notice 'not ok - release id conflict: %', r; end if;
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000009', null, 'sha256:stale'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000009', 'Stale'));
  if r ->> 'code' = 'STALE_BASE' then raise notice 'ok - stale base release is rejected';
  else raise notice 'not ok - stale base: %', r; end if;
end $$;

-- Live work on the published session.
do $$ begin
  insert into public.session_states (session_id, project_id, status) values ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'scheduled');
  insert into public.checklist_items (id, project_id, subject_id, label) values ('22222222-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'Prep item');
  insert into public.gm_notes (id, project_id, subject_id, body, author_label) values ('22222222-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'secret', 'GM A');
  insert into public.print_jobs (id, project_id, title, requested_quantity, linked_record_ids) values ('22222222-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Print', 3, array['11111111-0000-4000-8000-000000000002'::uuid]);
  raise notice 'ok - GM writes live records linked to stable identities';
exception when others then raise notice 'not ok - GM live writes: %', sqlerrm;
end $$;

do $$ begin
  insert into public.checklist_items (id, project_id, subject_id, label) values (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', 'On an entity');
  raise notice 'not ok - checklist accepted an entity subject';
exception when foreign_key_violation then raise notice 'ok - checklist subject must be a session or story';
end $$;

-- Optimistic concurrency.
do $$
declare n int;
begin
  update public.checklist_items set done = true, revision = 2 where id = '22222222-0000-4000-8000-000000000001' and revision = 1;
  get diagnostics n = row_count;
  update public.checklist_items set label = 'lost update', revision = 2 where id = '22222222-0000-4000-8000-000000000001' and revision = 1;
  if n = 1 and (select count(*) from public.checklist_items where label = 'lost update') = 0 then raise notice 'ok - stale revision update affects no rows';
  else raise notice 'not ok - CAS'; end if;
  begin
    update public.checklist_items set label = 'skip', revision = 9 where id = '22222222-0000-4000-8000-000000000001';
    raise notice 'not ok - revision jump accepted';
  exception when serialization_failure then raise notice 'ok - revision must increase by exactly one';
  end;
  begin
    update public.checklist_items set subject_id = '11111111-0000-4000-8000-000000000001', revision = 3 where id = '22222222-0000-4000-8000-000000000001';
    raise notice 'not ok - subject_id changed';
  exception when insufficient_privilege then raise notice 'ok - live identity columns are immutable';
  end;
end $$;

-- Ownership boundary: published tables are read-only to the GM role.
do $$ begin
  update public.release_records set data = '{}'::jsonb;
  raise notice 'not ok - GM updated release_records directly';
exception when insufficient_privilege then raise notice 'ok - GM cannot update published records directly';
end $$;
do $$ begin
  insert into public.releases (id, project_id, version, kind, bundle_hash, schema_version, created_at, published_by, counts)
  values (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 99, 'publish', 'x', 'x', now(), '{}', '{}');
  raise notice 'not ok - GM inserted a release directly';
exception when insufficient_privilege then raise notice 'ok - GM cannot insert releases directly';
end $$;
do $$ begin
  update public.projects set active_release_id = null;
  raise notice 'not ok - GM switched active release directly';
exception when insufficient_privilege then raise notice 'ok - GM cannot switch the active release directly';
end $$;
do $$ begin
  update public.gm_notes set body = 'changed';
  raise notice 'not ok - gm note edited';
exception when insufficient_privilege then raise notice 'ok - GM notes are append-only';
end $$;

-- Print rules.
do $$ begin
  update public.print_jobs set status = 'complete', revision = 2 where id = '22222222-0000-4000-8000-000000000003';
  raise notice 'not ok - complete with outstanding pieces';
exception when check_violation then raise notice 'ok - print cannot be complete with outstanding pieces';
end $$;
do $$
declare r jsonb;
begin
  r := public.tide_record_print_attempt('22222222-0000-4000-8000-000000000003', 1, 1, 0, gen_random_uuid(), 'succeeded', 1, null);
  if r ->> 'status' = 'ok' and (select completed_quantity from public.print_jobs where id = '22222222-0000-4000-8000-000000000003') = 1
     and (select requested_quantity from public.print_jobs where id = '22222222-0000-4000-8000-000000000003') = 3
  then raise notice 'ok - print attempt updates counters atomically without changing requested quantity';
  else raise notice 'not ok - print attempt: %', r; end if;
  r := public.tide_record_print_attempt('22222222-0000-4000-8000-000000000003', 1, 2, 0, gen_random_uuid(), 'succeeded', 1, null);
  if r ->> 'status' = 'conflict' and (select count(*) from public.print_attempts) = 1 then raise notice 'ok - stale print attempt is a conflict and appends nothing';
  else raise notice 'not ok - stale attempt: %', r; end if;
end $$;

-- Publish v2: rename the entity and archive the session. Live rows must be untouched.
do $$
declare r jsonb; before_live text; after_live text;
begin
  select md5(string_agg(x, '|' order by x)) into before_live from (
    select row_to_json(s)::text x from public.session_states s union all
    select row_to_json(c)::text from public.checklist_items c union all
    select row_to_json(p)::text from public.print_jobs p union all
    select row_to_json(g)::text from public.gm_notes g) t;
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-1111-4000-8000-000000000001', 'sha256:r2'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000002', 'Teruānga (renamed)', 'archived'));
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000003', 'aaaaaaaa-1111-4000-8000-000000000002', 'sha256:r3', 'rollback'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000003', 'Teruānga'));
  select md5(string_agg(x, '|' order by x)) into after_live from (
    select row_to_json(s)::text x from public.session_states s union all
    select row_to_json(c)::text from public.checklist_items c union all
    select row_to_json(p)::text from public.print_jobs p union all
    select row_to_json(g)::text from public.gm_notes g) t;
  if r ->> 'status' = 'applied' and (r -> 'release' ->> 'version')::int = 3 and before_live = after_live
  then raise notice 'ok - publish + rollback (version 3) leave live records byte-identical';
  else raise notice 'not ok - live rows changed or rollback failed: %', r; end if;
  if (select count(*) from public.record_identities where id = '11111111-0000-4000-8000-000000000003') = 1
  then raise notice 'ok - renaming keeps a single stable identity';
  else raise notice 'not ok - identity duplicated'; end if;
end $$;

-- Transactional failure: a type change for an existing identity aborts the whole commit.
do $$
declare v_before uuid; v_count int;
begin
  select active_release_id into v_before from public.projects where id = 'aaaaaaaa-0000-4000-8000-000000000001';
  begin
    perform public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
      tests.release('aaaaaaaa-1111-4000-8000-000000000004', 'aaaaaaaa-1111-4000-8000-000000000003', 'sha256:r4'),
      tests.snapshot('aaaaaaaa-1111-4000-8000-000000000004', 'Bad', 'active', 'media'));
    raise notice 'not ok - type change accepted';
  exception when others then null;
  end;
  select count(*) into v_count from public.releases where id = 'aaaaaaaa-1111-4000-8000-000000000004';
  if v_count = 0 and (select active_release_id from public.projects where id = 'aaaaaaaa-0000-4000-8000-000000000001') = v_before
  then raise notice 'ok - failed commit leaves no partial release and keeps the active release';
  else raise notice 'not ok - partial release visible'; end if;
end $$;

do $$ begin
  if (select count(*) from public.publication_events where outcome = 'applied') = 3 then raise notice 'ok - audit trail records applied releases';
  else raise notice 'not ok - audit count %', (select count(*) from public.publication_events); end if;
end $$;

do $$ begin
  if (select count(*) from storage.objects) = 1 then raise notice 'ok - GM sees only own-project private assets';
  else raise notice 'not ok - storage visibility %', (select count(*) from storage.objects); end if;
end $$;
reset role;

-- ---------------------------------------------------------------- GM B (other project)
set role authenticated;
select tests.claims('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'gm-b@example.test');
do $$ begin
  if (select count(*) from public.release_records) = 0 and (select count(*) from public.gm_notes) = 0
     and (select count(*) from public.projects where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0 and (select count(*) from public.print_jobs) = 0
  then raise notice 'ok - GM of another project reads none of project A';
  else raise notice 'not ok - cross-project read leak: rr=% notes=% projects=% prints=%', (select count(*) from public.release_records), (select count(*) from public.gm_notes), (select count(*) from public.projects), (select count(*) from public.print_jobs); end if;
end $$;
do $$ begin
  perform public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('bbbbbbbb-1111-4000-8000-000000000001', 'aaaaaaaa-1111-4000-8000-000000000003', 'sha256:b'),
    tests.snapshot('bbbbbbbb-1111-4000-8000-000000000001', 'B'));
  raise notice 'not ok - other GM published to project A';
exception when insufficient_privilege then raise notice 'ok - GM of another project cannot publish to project A';
end $$;
do $$ begin
  insert into public.checklist_items (id, project_id, subject_id, label) values (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'intrusion');
  raise notice 'not ok - other GM wrote into project A';
exception when insufficient_privilege then raise notice 'ok - GM of another project cannot write project A live records';
end $$;
do $$
declare n int;
begin
  update public.checklist_items set done = false, revision = 3 where project_id = 'aaaaaaaa-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n = 0 then raise notice 'ok - GM of another project cannot update project A rows';
  else raise notice 'not ok - updated % rows', n; end if;
end $$;
do $$ begin
  insert into public.checklist_items (id, project_id, subject_id, label) values (gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'cross-project subject');
  raise notice 'not ok - cross-project subject accepted';
exception when foreign_key_violation then raise notice 'ok - live records cannot reference another project''s identities';
end $$;
reset role;

-- ---------------------------------------------------------------- outsider (authenticated, no membership)
set role authenticated;
select tests.claims('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'outsider@example.test');
do $$ begin
  if (select count(*) from public.releases) = 0 and (select count(*) from public.session_states) = 0 and (select count(*) from storage.objects) = 0
  then raise notice 'ok - authenticated non-member reads nothing';
  else raise notice 'not ok - non-member read leak'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------- machine publisher (service role)
set role service_role;
select tests.claims('', 'service_role');
do $$
declare r jsonb;
begin
  r := public.tide_commit_release('aaaaaaaa-0000-4000-8000-000000000001',
    tests.release('aaaaaaaa-1111-4000-8000-000000000005', 'aaaaaaaa-1111-4000-8000-000000000003', 'sha256:r5'),
    tests.snapshot('aaaaaaaa-1111-4000-8000-000000000005', 'Teruānga'));
  if r ->> 'status' = 'applied' and r -> 'release' -> 'publishedBy' ->> 'kind' = 'machine' then raise notice 'ok - service-role publisher uses the same commit function';
  else raise notice 'not ok - service publish: %', r; end if;
end $$;
reset role;

-- ---------------------------------------------------------------- immutability even for the owner
do $$ begin
  delete from public.release_records;
  raise notice 'not ok - release history deleted';
exception when insufficient_privilege then raise notice 'ok - published history is immutable even for the table owner';
end $$;
do $$ begin
  delete from public.record_identities where id = '11111111-0000-4000-8000-000000000002';
  raise notice 'not ok - identity deleted';
exception when insufficient_privilege or foreign_key_violation then raise notice 'ok - stable identities cannot be deleted';
end $$;
