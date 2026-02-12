-- 1. New table: user_segment_access
-- Presence of rows = user is restricted to these segments.
-- No rows = unrestricted (sees all org segments).
create table user_segment_access (
  user_id uuid not null references profiles(id) on delete cascade,
  segment_id uuid not null references segments(id) on delete cascade,
  primary key (user_id, segment_id)
);

create index idx_user_segment_access_user on user_segment_access(user_id);
create index idx_user_segment_access_segment on user_segment_access(segment_id);

-- RLS on user_segment_access
alter table user_segment_access enable row level security;

-- Admins can read access entries for org members
create policy "Admins see org segment access" on user_segment_access
  for select using (
    public.is_admin()
    and exists (
      select 1 from profiles
      where profiles.id = user_segment_access.user_id
      and profiles.org_id = public.get_user_org_id()
    )
  );

-- Admins can insert access entries
create policy "Admins manage segment access insert" on user_segment_access
  for insert with check (
    public.is_admin()
    and exists (
      select 1 from profiles
      where profiles.id = user_segment_access.user_id
      and profiles.org_id = public.get_user_org_id()
    )
  );

-- Admins can delete access entries
create policy "Admins manage segment access delete" on user_segment_access
  for delete using (
    public.is_admin()
    and exists (
      select 1 from profiles
      where profiles.id = user_segment_access.user_id
      and profiles.org_id = public.get_user_org_id()
    )
  );

-- 2. RLS helper: can_access_segment
create or replace function public.can_access_segment(seg_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select
    public.is_admin()
    or not exists (
      select 1 from public.user_segment_access
      where user_id = auth.uid()
    )
    or exists (
      select 1 from public.user_segment_access
      where user_id = auth.uid()
      and segment_id = seg_id
    )
$$;

-- 3. Replace segments SELECT policy
drop policy "Org segments select" on segments;
create policy "Org segments select" on segments
  for select using (
    org_id = public.get_user_org_id()
    and public.can_access_segment(id)
  );
