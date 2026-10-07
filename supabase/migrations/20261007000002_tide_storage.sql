-- Private asset bucket. Objects live under "<project_id>/..." and are readable
-- only by that project's GMs. The app issues short-lived signed URLs per
-- request after its own authorization check; signed URLs are never stored.

insert into storage.buckets (id, name, public)
values ('tide-private', 'tide-private', false)
on conflict (id) do update set public = false;

create policy tide_private_gm_read on storage.objects for select to authenticated
  using (bucket_id = 'tide-private' and public.tide_is_gm(public.tide_try_uuid((storage.foldername(name))[1])));

create policy tide_private_gm_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tide-private' and public.tide_is_gm(public.tide_try_uuid((storage.foldername(name))[1])));

create policy tide_private_gm_update on storage.objects for update to authenticated
  using (bucket_id = 'tide-private' and public.tide_is_gm(public.tide_try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'tide-private' and public.tide_is_gm(public.tide_try_uuid((storage.foldername(name))[1])));

create policy tide_private_gm_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tide-private' and public.tide_is_gm(public.tide_try_uuid((storage.foldername(name))[1])));

grant execute on function public.tide_try_uuid(text) to authenticated;
