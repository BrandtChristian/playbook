alter table organizations enable row level security;
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table segments enable row level security;
alter table segment_contacts enable row level security;
alter table templates enable row level security;
alter table campaigns enable row level security;
alter table playbooks enable row level security;

-- Helper: get current user's org_id
create or replace function public.get_user_org_id()
returns uuid
language sql
stable
security definer
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Helper: check if current user is admin/owner
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select role in ('admin', 'owner') from public.profiles where id = auth.uid()
$$;

-- Organizations: users see their own org
create policy "Users see own org" on organizations for select using (id = public.get_user_org_id());
create policy "Owners update org" on organizations for update using (id = public.get_user_org_id() and public.is_admin());

-- Profiles: users see org members
create policy "Users see org profiles" on profiles for select using (org_id = public.get_user_org_id());
create policy "Users update own profile" on profiles for update using (id = auth.uid());

-- Contacts: org-scoped
create policy "Org contacts select" on contacts for select using (org_id = public.get_user_org_id());
create policy "Org contacts insert" on contacts for insert with check (org_id = public.get_user_org_id());
create policy "Org contacts update" on contacts for update using (org_id = public.get_user_org_id());
create policy "Org contacts delete" on contacts for delete using (org_id = public.get_user_org_id() and public.is_admin());

-- Segments: org-scoped
create policy "Org segments select" on segments for select using (org_id = public.get_user_org_id());
create policy "Org segments insert" on segments for insert with check (org_id = public.get_user_org_id());
create policy "Org segments update" on segments for update using (org_id = public.get_user_org_id());
create policy "Org segments delete" on segments for delete using (org_id = public.get_user_org_id() and public.is_admin());

-- Segment contacts: via segment's org
create policy "Org segment_contacts select" on segment_contacts for select
  using (exists (select 1 from segments where segments.id = segment_id and segments.org_id = public.get_user_org_id()));
create policy "Org segment_contacts insert" on segment_contacts for insert
  with check (exists (select 1 from segments where segments.id = segment_id and segments.org_id = public.get_user_org_id()));
create policy "Org segment_contacts delete" on segment_contacts for delete
  using (exists (select 1 from segments where segments.id = segment_id and segments.org_id = public.get_user_org_id()));

-- Templates: org-scoped + system templates visible to all
create policy "Templates select" on templates for select
  using (is_system = true or org_id = public.get_user_org_id());
create policy "Templates insert" on templates for insert
  with check (org_id = public.get_user_org_id());
create policy "Templates update" on templates for update
  using (org_id = public.get_user_org_id());

-- Campaigns: org-scoped
create policy "Org campaigns select" on campaigns for select using (org_id = public.get_user_org_id());
create policy "Org campaigns insert" on campaigns for insert with check (org_id = public.get_user_org_id());
create policy "Org campaigns update" on campaigns for update using (org_id = public.get_user_org_id());

-- Playbooks: readable by all authenticated users
create policy "Playbooks readable" on playbooks for select to authenticated using (true);
