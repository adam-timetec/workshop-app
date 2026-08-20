-- TimeTec Lunch Orders
-- Run in the Supabase SQL editor after the previous workshop `items` table is removed.
-- Safe to re-run; this file contains no drop, truncate, or delete-table statements.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  department text check (department is null or char_length(department) <= 80),
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  description text check (description is null or char_length(description) <= 240),
  price_cents integer not null check (price_cents >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create table if not exists public.ordering_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  vendor_name text not null check (char_length(vendor_name) between 1 and 100),
  order_date date not null,
  cutoff_at timestamptz not null,
  status text not null default 'planned'
    check (status in ('planned', 'open', 'closed', 'cancelled')),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ordering_rounds_one_open_idx
  on public.ordering_rounds ((status)) where status = 'open';
create index if not exists ordering_rounds_date_idx
  on public.ordering_rounds (order_date desc, created_at desc);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.ordering_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted', 'cancelled')),
  note text check (note is null or char_length(note) <= 300),
  total_cents integer not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, user_id)
);

create index if not exists orders_round_status_idx
  on public.orders (round_id, status, created_at);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  item_name text not null check (char_length(item_name) between 1 and 100),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20),
  note text check (note is null or char_length(note) <= 160),
  created_at timestamptz not null default now(),
  unique (order_id, menu_item_id)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'TimeTec staff'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'TimeTec staff'
  )
from auth.users as users
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create or replace trigger menu_categories_set_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();
create or replace trigger menu_items_set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create or replace trigger ordering_rounds_set_updated_at before update on public.ordering_rounds
  for each row execute function public.set_updated_at();
create or replace trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.ordering_rounds enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_read_staff') then
    create policy profiles_read_staff on public.profiles for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_admin') then
    create policy profiles_update_admin on public.profiles for update to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_categories' and policyname = 'menu_categories_read_staff') then
    create policy menu_categories_read_staff on public.menu_categories for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_categories' and policyname = 'menu_categories_admin_all') then
    create policy menu_categories_admin_all on public.menu_categories for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_items' and policyname = 'menu_items_read_staff') then
    create policy menu_items_read_staff on public.menu_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'menu_items' and policyname = 'menu_items_admin_all') then
    create policy menu_items_admin_all on public.menu_items for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ordering_rounds' and policyname = 'ordering_rounds_read_staff') then
    create policy ordering_rounds_read_staff on public.ordering_rounds for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ordering_rounds' and policyname = 'ordering_rounds_admin_all') then
    create policy ordering_rounds_admin_all on public.ordering_rounds for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_read_staff') then
    create policy orders_read_staff on public.orders for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_admin_all') then
    create policy orders_admin_all on public.orders for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_read_staff') then
    create policy order_items_read_staff on public.order_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_admin_all') then
    create policy order_items_admin_all on public.order_items for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
end $$;

create or replace function public.save_my_order(p_round_id uuid, p_note text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_requested_count integer;
  v_valid_count integer;
  v_round public.ordering_rounds%rowtype;
begin
  if v_user_id is null then
    raise exception 'You must sign in before saving an order.';
  end if;

  select * into v_round from public.ordering_rounds where id = p_round_id;
  if not found then raise exception 'This ordering round no longer exists.'; end if;
  if v_round.status <> 'open' or v_round.cutoff_at <= now() then
    raise exception 'This ordering round is closed.';
  end if;
  if p_note is not null and char_length(p_note) > 300 then
    raise exception 'Keep the order note under 300 characters.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one menu item.';
  end if;

  select count(*), count(distinct parsed.item_id)
  into v_requested_count, v_valid_count
  from jsonb_to_recordset(p_items) as parsed(item_id uuid, quantity integer, note text)
  join public.menu_items as menu_item on menu_item.id = parsed.item_id and menu_item.is_available
  where parsed.quantity between 1 and 20
    and (parsed.note is null or char_length(parsed.note) <= 160);

  if v_requested_count <> jsonb_array_length(p_items)
     or v_valid_count <> jsonb_array_length(p_items) then
    raise exception 'One or more menu selections are invalid or unavailable.';
  end if;

  insert into public.orders (round_id, user_id, status, note)
  values (p_round_id, v_user_id, 'submitted', nullif(trim(p_note), ''))
  on conflict (round_id, user_id) do update
    set status = 'submitted', note = excluded.note, updated_at = now()
  returning id into v_order_id;

  delete from public.order_items where order_id = v_order_id;
  insert into public.order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, note)
  select v_order_id, menu_item.id, menu_item.name, menu_item.price_cents,
    parsed.quantity, nullif(trim(parsed.note), '')
  from jsonb_to_recordset(p_items) as parsed(item_id uuid, quantity integer, note text)
  join public.menu_items as menu_item on menu_item.id = parsed.item_id;

  update public.orders
  set total_cents = (
    select coalesce(sum(unit_price_cents * quantity), 0)
    from public.order_items where order_id = v_order_id
  )
  where id = v_order_id;

  return v_order_id;
end;
$$;

create or replace function public.cancel_my_order(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'You must sign in before cancelling an order.'; end if;
  if not exists (
    select 1 from public.ordering_rounds
    where id = p_round_id and status = 'open' and cutoff_at > now()
  ) then
    raise exception 'This ordering round is closed.';
  end if;

  update public.orders set status = 'cancelled', updated_at = now()
  where round_id = p_round_id and user_id = auth.uid();
end;
$$;

revoke all on function public.save_my_order(uuid, text, jsonb) from public;
revoke all on function public.cancel_my_order(uuid) from public;
grant execute on function public.save_my_order(uuid, text, jsonb) to authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;

insert into public.menu_categories (name, sort_order)
values ('Mains', 10), ('Drinks', 20), ('Sides', 30)
on conflict (name) do nothing;

insert into public.menu_items (category_id, name, description, price_cents, sort_order)
select category.id, seed.name, seed.description, seed.price_cents, seed.sort_order
from (
  values
    ('Mains', 'Chicken rice', 'Roasted chicken, fragrant rice, chilli sauce', 1200, 10),
    ('Mains', 'Vegetable fried rice', 'Wok-fried rice with seasonal vegetables', 1000, 20),
    ('Mains', 'Curry noodles', 'Noodles in a mild coconut curry broth', 1150, 30),
    ('Drinks', 'Iced lemon tea', 'Less-sweet by default', 350, 10),
    ('Drinks', 'Mineral water', '500 ml bottle', 200, 20),
    ('Sides', 'Fruit cup', 'Seasonal cut fruit', 450, 10)
) as seed(category_name, name, description, price_cents, sort_order)
join public.menu_categories as category on category.name = seed.category_name
on conflict (category_id, name) do nothing;

-- Promote the first administrator after running this script:
-- update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
