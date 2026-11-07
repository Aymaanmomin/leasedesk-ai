-- LeaseDesk AI — Milestone 1: foundation schema
-- Organizations, memberships, properties, units, tenants, contracts, activity log.
-- All tables are organization-scoped and protected by Row Level Security.


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'manager', 'viewer');
create type public.lease_type as enum ('residential', 'business_park', 'gas_station_adjacent');
create type public.contract_status as enum (
  'draft', 'pending_signature', 'executed', 'terminated', 'archived'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_memberships (user_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),        -- display name, renamable
  address_line text not null,                                 -- legal address
  city text not null,
  state text not null default 'TX' check (length(state) = 2),
  zip text not null check (zip ~ '^\d{5}(-\d{4})?$'),
  category text not null default 'commercial'
    check (category in ('residential', 'business_park', 'gas_station_adjacent', 'commercial', 'other')),
  description text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.properties (organization_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  building_name text,
  unit_label text not null,              -- e.g. "Suite A"
  square_feet integer check (square_feet is null or square_feet > 0),
  created_at timestamptz not null default now(),
  unique (property_id, building_name, unit_label)
);
create index on public.units (property_id);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text not null,
  business_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
create index on public.tenants (organization_id);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  tenant_id uuid references public.tenants(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  lease_type public.lease_type not null,
  status public.contract_status not null default 'draft',
  monthly_rent_cents bigint check (monthly_rent_cents is null or monthly_rent_cents >= 0),
  start_date date,
  end_date date,
  executed_at timestamptz,               -- set once; non-null means locked
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.contracts (organization_id, status);
create index on public.contracts (end_date);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  contract_id uuid references public.contracts(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_logs (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.org_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships
    where organization_id = org and user_id = auth.uid() and role = any(roles)
  );
$$;

-- Creates an organization and makes the caller its owner, atomically.
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into organizations (name, created_by) values (org_name, auth.uid()) returning id into new_id;
  insert into organization_memberships (organization_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into activity_logs (organization_id, actor_id, event_type, details)
    values (new_id, auth.uid(), 'organization_created', jsonb_build_object('name', org_name));
  return new_id;
end;
$$;
revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger properties_touch before update on public.properties
  for each row execute function public.touch_updated_at();
create trigger contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();

-- Units/contracts must reference rows in the same organization.
create or replace function public.enforce_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'units' then
    if not exists (select 1 from properties where id = new.property_id and organization_id = new.organization_id) then
      raise exception 'property belongs to another organization';
    end if;
  elsif tg_table_name = 'contracts' then
    if not exists (select 1 from properties where id = new.property_id and organization_id = new.organization_id) then
      raise exception 'property belongs to another organization';
    end if;
    if new.unit_id is not null and not exists (
      select 1 from units where id = new.unit_id and property_id = new.property_id) then
      raise exception 'unit does not belong to this property';
    end if;
    if new.tenant_id is not null and not exists (
      select 1 from tenants where id = new.tenant_id and organization_id = new.organization_id) then
      raise exception 'tenant belongs to another organization';
    end if;
  end if;
  return new;
end;
$$;
create trigger units_same_org before insert or update on public.units
  for each row execute function public.enforce_same_org();
create trigger contracts_same_org before insert or update on public.contracts
  for each row execute function public.enforce_same_org();

-- Executed contracts are immutable (full signing lands in Milestone 6; the lock exists now).
-- Only a status transition to 'archived' or 'terminated' is allowed, nothing else may change.
create or replace function public.lock_executed_contracts()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('executed', 'terminated') then new.executed_at := coalesce(new.executed_at, now()); end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.executed_at is not null then
      raise exception 'executed contracts cannot be deleted';
    end if;
    return old;
  end if;
  if old.executed_at is null and new.status in ('executed', 'terminated') then
    new.executed_at := now();
  end if;
  -- Once executed, the record stays locked even after being archived.
  if old.executed_at is not null then
    if (to_jsonb(new) - 'status' - 'updated_at') <> (to_jsonb(old) - 'status' - 'updated_at')
       or new.status not in ('executed', 'terminated', 'archived') then
      raise exception 'executed contracts are immutable; create an amendment instead';
    end if;
  end if;
  return new;
end;
$$;
create trigger contracts_lock before insert or update or delete on public.contracts
  for each row execute function public.lock_executed_contracts();

-- Activity logs are append-only.
create or replace function public.deny_mutation()
returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end;
$$;
create trigger activity_logs_append_only before update or delete on public.activity_logs
  for each row execute function public.deny_mutation();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.contracts enable row level security;
alter table public.activity_logs enable row level security;

create policy org_select on public.organizations for select using (public.is_org_member(id));
create policy org_update on public.organizations for update
  using (public.has_org_role(id, array['owner']::public.org_role[]));

create policy membership_select on public.organization_memberships for select
  using (public.is_org_member(organization_id));
create policy membership_owner_write on public.organization_memberships for all
  using (public.has_org_role(organization_id, array['owner']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner']::public.org_role[]));

-- Same pattern for every org-scoped data table: members read, owners/managers write.
do $$
declare t text;
begin
  foreach t in array array['properties', 'units', 'tenants', 'contracts'] loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_org_member(organization_id))', t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert
      with check (public.has_org_role(organization_id, array['owner','manager']::public.org_role[]))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update
      using (public.has_org_role(organization_id, array['owner','manager']::public.org_role[]))
      with check (public.has_org_role(organization_id, array['owner','manager']::public.org_role[]))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete
      using (public.has_org_role(organization_id, array['owner','manager']::public.org_role[]))$p$, t);
  end loop;
end $$;

create policy activity_select on public.activity_logs for select
  using (public.is_org_member(organization_id));
create policy activity_insert on public.activity_logs for insert
  with check (public.is_org_member(organization_id) and actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (explicit; the project does not auto-expose new tables)
-- Least privilege: each grant matches an RLS policy above. anon gets nothing.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, update on public.organizations to authenticated;  -- insert only via create_organization()
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.properties to authenticated;
grant select, insert, update, delete on public.units to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert on public.activity_logs to authenticated;   -- append-only

-- Helper functions used inside RLS policies must be executable by the caller.
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.org_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;
