-- PujoSathi · Supabase schema (free Pujo discovery + planning platform)
-- Paste into Supabase SQL editor. RLS: users can only touch their own rows.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  email text,
  phone text,
  created_at timestamptz default now()
);
create table public.saved_places (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  place_type text not null check (place_type in ('restaurant','pandal')),
  created_at timestamptz default now(),
  unique (user_id, place_id, place_type)
);
create table public.visited_places (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  place_type text not null check (place_type in ('restaurant','pandal')),
  visited_at timestamptz default now(),
  unique (user_id, place_id, place_type)
);
create table public.pujo_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text default 'My Pujo',
  share_slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table public.pujo_plan_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.pujo_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  place_type text not null check (place_type in ('restaurant','pandal')),
  pujo_day text not null check (pujo_day in ('shashthi','saptami','ashtami','navami','dashami')),
  visit_time text,
  sort_order int default 0,
  done boolean default false,
  created_at timestamptz default now()
);
create index on public.saved_places (user_id);
create index on public.visited_places (user_id);
create index on public.pujo_plans (user_id);
create index on public.pujo_plan_items (plan_id);
create index on public.pujo_plan_items (user_id);

-- auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'name','Pujo Friend'), coalesce(new.email,''), coalesce(new.phone,''))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.saved_places enable row level security;
alter table public.visited_places enable row level security;
alter table public.pujo_plans enable row level security;
alter table public.pujo_plan_items enable row level security;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own saved" on public.saved_places for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own visited" on public.visited_places for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans" on public.pujo_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plan items" on public.pujo_plan_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
