-- 집합(Jiphap) 스키마
-- Supabase SQL Editor 또는 supabase/migrations/ 에 넣어 실행한다.
--
-- 설계 원칙 (ARCHITECTURE.md §3)
--   * 클라이언트는 읽기만. INSERT/UPDATE/DELETE 정책을 만들지 않아 RLS 기본 거부에 걸린다
--   * 모든 쓰기는 Server Action에서 service_role 키로 수행한다
--   * 원좌표(lat/lng)는 검증에만 쓰고 저장하지 않는다. 거리와 정확도만 남긴다

-- ============================================================
-- profiles — auth.users 확장
-- ============================================================

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text not null,
  status        text not null default 'pending'
                check (status in ('pending','active','rejected','inactive')),
  role          text not null default 'member'
                check (role in ('member','admin')),
  device_id     text,                        -- 계정↔기기 바인딩 (약한 억제 장치)
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  approved_by   uuid references profiles(id)
);

create index on profiles (status);

-- 카카오 로그인 직후 pending 프로필 자동 생성
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'preferred_username',
      '이름없음'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS 정책에서 재귀를 피하기 위한 헬퍼
create function is_active_member() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- ============================================================
-- places — 집합 장소
-- ============================================================

create table places (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  lat            double precision not null,
  lng            double precision not null,
  default_radius int  not null default 60 check (default_radius between 20 and 300),
  is_active      boolean not null default true,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- recurring_schedules — 반복 일정 규칙
-- ============================================================

create table recurring_schedules (
  id              uuid primary key default gen_random_uuid(),
  place_id        uuid not null references places(id),
  weekdays        smallint[] not null,          -- 0=일 … 6=토
  meet_time       time not null,                -- 로컬(KST) 기준
  open_before_min int  not null default 10 check (open_before_min between 0 and 120),
  open_after_min  int  not null default 10 check (open_after_min  between 0 and 120),
  radius          int  not null default 60 check (radius between 20 and 300),
  is_active       boolean not null default true,
  active_from     date not null default current_date,
  active_until    date,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- sessions — 실제 집합 하나
-- ============================================================
-- 장소 정보를 스냅샷으로 복사한다. 장소를 옮기거나 반경을 바꿔도
-- 과거 기록의 판정 근거가 틀어지면 안 된다 (ARCHITECTURE.md §7)

create table sessions (
  id              uuid primary key default gen_random_uuid(),
  place_id        uuid references places(id),
  schedule_id     uuid references recurring_schedules(id),  -- null이면 임시 세션

  place_name      text not null,                -- ↓ 스냅샷
  place_lat       double precision not null,
  place_lng       double precision not null,
  radius          int not null,

  meet_at         timestamptz not null,
  open_before_min int not null default 10,
  open_after_min  int not null default 10,

  canceled_at     timestamptz,
  cancel_reason   text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

create index on sessions (meet_at desc);

-- 반복 일정에서 같은 시각의 세션이 중복 생성되는 것을 막는다.
-- 크론이 매일 돌면서 같은 구간을 다시 훑기 때문에 반드시 필요하다.
create unique index sessions_schedule_slot
  on sessions (schedule_id, meet_at) where schedule_id is not null;

-- 창 경계를 계산하는 생성 열. 쿼리에서 재사용한다
alter table sessions
  add column opens_at  timestamptz
    generated always as (meet_at - make_interval(mins => open_before_min)) stored,
  add column closes_at timestamptz
    generated always as (meet_at + make_interval(mins => open_after_min))  stored;

-- ============================================================
-- check_ins — 출석 기록
-- ============================================================

create table check_ins (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  member_id   uuid not null references profiles(id),

  checked_at  timestamptz not null default now(),   -- 서버 시각. 클라이언트 값 금지
  dist_m      int,                                  -- 출첵 순간의 거리
  accuracy_m  int,                                  -- 당시 GPS 오차
  method      text not null default 'gps'
              check (method in ('gps','manual')),
  created_by  uuid references profiles(id),         -- manual일 때 누가 눌렀나
  note        text,

  unique (session_id, member_id)                    -- 하루 두 번 출첵 방지
);

create index on check_ins (session_id);
create index on check_ins (member_id, checked_at desc);

-- 지각 여부는 저장하지 않는다. 표시할 때 checked_at > meet_at 으로 계산한다

-- ============================================================
-- RLS — 읽기만 허용, 쓰기는 전부 service_role
-- ============================================================

alter table profiles            enable row level security;
alter table places              enable row level security;
alter table recurring_schedules enable row level security;
alter table sessions            enable row level security;
alter table check_ins           enable row level security;

-- 본인 프로필은 항상 읽을 수 있다 (pending 상태에서도 승인 대기 화면을 봐야 함)
create policy profiles_self on profiles
  for select to authenticated using (id = auth.uid());

-- 정회원은 다른 정회원의 이름을 볼 수 있다 (명단 표시용)
create policy profiles_roster on profiles
  for select to authenticated
  using (status = 'active' and is_active_member());

-- 나머지는 정회원만 조회 가능
create policy places_read on places
  for select to authenticated using (is_active_member());

create policy schedules_read on recurring_schedules
  for select to authenticated using (is_active_member());

create policy sessions_read on sessions
  for select to authenticated using (is_active_member());

-- 명단은 모두에게 공개한다. 이것이 대리 출첵의 사회적 억제 장치다
create policy check_ins_read on check_ins
  for select to authenticated using (is_active_member());

-- INSERT / UPDATE / DELETE 정책은 의도적으로 만들지 않는다.
-- 정책이 없으면 RLS 기본 거부에 걸려 클라이언트는 쓸 수 없다.
-- 모든 쓰기는 Server Action이 service_role 키로 수행한다.

-- ============================================================
-- Realtime — 명단 실시간 갱신
-- ============================================================

alter publication supabase_realtime add table check_ins;

-- ============================================================
-- 초기 운영자 지정 (Supabase 대시보드에서 수동 실행)
-- ============================================================
-- 첫 관리자는 UI로 만들 수 없다. 본인이 카카오 로그인을 한 뒤
-- auth.users 에서 자기 uuid를 찾아 아래를 직접 실행한다.
--
-- update profiles
--    set role = 'admin', status = 'active', approved_at = now()
--  where id = '여기에-본인-uuid';
