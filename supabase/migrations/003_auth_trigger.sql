-- Auto-create profile + org on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
begin
  -- Create org for new user
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data->>'org_name', split_part(new.email, '@', 2)))
  returning id into new_org_id;

  -- Create profile
  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
