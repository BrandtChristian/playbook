-- Invitation status enum
create type invitation_status as enum ('pending', 'accepted', 'expired');

-- Invitations table
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role user_role not null default 'member',
  invited_by uuid references profiles(id),
  status invitation_status default 'pending',
  created_at timestamptz default now(),
  unique(org_id, email)
);

create index idx_invitations_org on invitations(org_id);
create index idx_invitations_email on invitations(email);

-- RLS for invitations
alter table invitations enable row level security;

create policy "Admins see org invitations" on invitations
  for select using (org_id = public.get_user_org_id() and public.is_admin());

create policy "Admins create invitations" on invitations
  for insert with check (org_id = public.get_user_org_id() and public.is_admin());

create policy "Admins update invitations" on invitations
  for update using (org_id = public.get_user_org_id() and public.is_admin());

create policy "Admins delete invitations" on invitations
  for delete using (org_id = public.get_user_org_id() and public.is_admin());

-- Allow owners to update other profiles' roles in their org
create policy "Owners update org profiles" on profiles
  for update using (
    org_id = public.get_user_org_id()
    and (select role from profiles where id = auth.uid()) = 'owner'
  );

-- Replace handle_new_user() to support invited users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_org uuid;
  invited_role_val text;
  new_org_id uuid;
begin
  -- Check if this user was invited to an existing org
  invited_org := (new.raw_user_meta_data->>'invited_org_id')::uuid;
  invited_role_val := new.raw_user_meta_data->>'invited_role';

  if invited_org is not null then
    -- Invited user: join existing org, don't create new one
    insert into public.profiles (id, org_id, full_name, role)
    values (
      new.id,
      invited_org,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(invited_role_val, 'member')::public.user_role
    );

    -- Mark the invitation as accepted
    update public.invitations
    set status = 'accepted'
    where email = new.email
      and org_id = invited_org
      and status = 'pending';
  else
    -- Normal signup: create new org + profile as owner
    insert into public.organizations (name)
    values (coalesce(new.raw_user_meta_data->>'org_name', split_part(new.email, '@', 2)))
    returning id into new_org_id;

    insert into public.profiles (id, org_id, full_name, role)
    values (
      new.id,
      new_org_id,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      'owner'
    );
  end if;

  return new;
end;
$$;
