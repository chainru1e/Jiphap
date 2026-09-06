-- 0002_rls.sql — RLS 정책 (T04)
-- T03에서는 실행하지 않는다. 0001_schema.sql을 먼저 적용하고 검증한 뒤에 적용한다.
--
-- RLS 켜기(alter table ... enable row level security)는 0001에 들어 있다.
-- 이 파일은 create policy 문만 담는다.

-- ============================================================
-- RLS — 읽기만 허용, 쓰기는 전부 service_role
-- ============================================================

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
-- 모든 쓰기는 Server Action이 secret 키(service_role 롤)로 수행한다.
