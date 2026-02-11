-- Enums
create type user_role as enum ('owner', 'admin', 'member');
create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'failed');
create type playbook_category as enum ('welcome', 'newsletter', 'winback', 'promotional', 'transactional', 'onboarding');

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resend_api_key text,
  from_email text,
  from_name text,
  domain_verified boolean default false,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  full_name text,
  avatar_url text,
  role user_role default 'member',
  created_at timestamptz default now()
);

-- Contacts (the recipients)
create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  data jsonb default '{}',
  resend_contact_id text,
  unsubscribed boolean default false,
  created_at timestamptz default now(),
  unique(org_id, email)
);

-- Segments (groups of contacts)
create table segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  resend_segment_id text,
  contact_count integer default 0,
  created_at timestamptz default now()
);

-- Segment membership
create table segment_contacts (
  segment_id uuid references segments(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  primary key (segment_id, contact_id)
);

-- Templates (Liquid + React Email)
create table templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  subject text not null,
  body_html text not null,
  category playbook_category,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- Playbooks (guided campaign strategies)
create table playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  category playbook_category not null,
  icon text,
  is_system boolean default true,
  steps jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Campaigns
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references profiles(id),
  name text not null,
  template_id uuid references templates(id),
  segment_id uuid references segments(id),
  subject text not null,
  body_html text not null,
  status campaign_status default 'draft',
  resend_broadcast_id text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index idx_contacts_org on contacts(org_id);
create index idx_contacts_email on contacts(org_id, email);
create index idx_segments_org on segments(org_id);
create index idx_templates_org on templates(org_id);
create index idx_campaigns_org on campaigns(org_id);
create index idx_campaigns_status on campaigns(org_id, status);
create index idx_segment_contacts_contact on segment_contacts(contact_id);
