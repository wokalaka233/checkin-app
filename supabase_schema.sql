-- 打卡网站 Supabase 数据库初始化脚本
-- 新建 Supabase 项目后，在 SQL Editor 中执行

-- 启用 UUID 扩展（默认已启用，保险起见）
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. profiles：用户资料表，与 auth.users 一一对应
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean default false,
  temp_password text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.profiles is '用户资料，注册时由触发器自动创建';

-- ============================================================
-- 2. projects：打卡项目/小组
-- ============================================================
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  color text,
  created_by uuid references public.profiles(id) on delete set null,
  daily_count integer default 1,
  daily_type text default 'count',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 3. project_members：项目成员关系
-- ============================================================
create table if not exists public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

-- ============================================================
-- 4. checkins：每日打卡记录
-- ============================================================
create table if not exists public.checkins (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null,
  text text,
  media_urls jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 5. comments：打卡评论
-- ============================================================
create table if not exists public.comments (
  id uuid default uuid_generate_v4() primary key,
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 6. friends：好友关系（pending / accepted）
-- ============================================================
create table if not exists public.friends (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

-- ============================================================
-- 7. messages：私信
-- ============================================================
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  type text default 'text',
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 索引
-- ============================================================
create index if not exists idx_checkins_project_date on public.checkins(project_id, checkin_date);
create index if not exists idx_checkins_user_date on public.checkins(user_id, checkin_date);
create index if not exists idx_comments_checkin on public.comments(checkin_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_friends_user on public.friends(user_id);
create index if not exists idx_friends_friend on public.friends(friend_id);
create index if not exists idx_messages_from_to on public.messages(from_user_id, to_user_id);
create index if not exists idx_messages_to_from on public.messages(to_user_id, from_user_id);

-- ============================================================
-- 触发器：用户注册后自动创建 profiles 记录
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RLS 策略（启用行级安全）
-- ============================================================

-- profiles
alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- projects
alter table public.projects enable row level security;

create policy "projects_select_member"
  on public.projects for select
  using (
    created_by = auth.uid() or
    exists (select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid())
  );

create policy "projects_insert_creator"
  on public.projects for insert
  with check (created_by = auth.uid());

create policy "projects_update_creator"
  on public.projects for update
  using (created_by = auth.uid());

-- project_members
alter table public.project_members enable row level security;

create policy "project_members_select_member"
  on public.project_members for select
  using (
    user_id = auth.uid() or
    exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid())
  );

create policy "project_members_insert_creator"
  on public.project_members for insert
  with check (
    exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

create policy "project_members_delete_creator"
  on public.project_members for delete
  using (
    exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

-- checkins
alter table public.checkins enable row level security;

create policy "checkins_select_member"
  on public.checkins for select
  using (
    user_id = auth.uid() or
    exists (select 1 from public.project_members pm where pm.project_id = checkins.project_id and pm.user_id = auth.uid())
  );

create policy "checkins_insert_self"
  on public.checkins for insert
  with check (user_id = auth.uid());

-- comments
alter table public.comments enable row level security;

create policy "comments_select_member"
  on public.comments for select
  using (
    exists (
      select 1 from public.checkins c
      join public.project_members pm on pm.project_id = c.project_id
      where c.id = comments.checkin_id and pm.user_id = auth.uid()
    )
  );

create policy "comments_insert_self"
  on public.comments for insert
  with check (user_id = auth.uid());

-- friends
alter table public.friends enable row level security;

create policy "friends_select_self"
  on public.friends for select
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friends_insert_self"
  on public.friends for insert
  with check (user_id = auth.uid());

create policy "friends_update_involved"
  on public.friends for update
  using (user_id = auth.uid() or friend_id = auth.uid());

-- messages
alter table public.messages enable row level security;

create policy "messages_select_self"
  on public.messages for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "messages_insert_self"
  on public.messages for insert
  with check (from_user_id = auth.uid());

-- ============================================================
-- Storage：媒体文件 bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_select_public"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media_insert_authenticated"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
