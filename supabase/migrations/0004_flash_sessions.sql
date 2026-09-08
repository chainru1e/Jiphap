-- 0004_flash_sessions.sql — 번개 세션 지원 (T42)
--
-- 적용 방식은 README.md를 따른다
-- 설계 근거: ARCHITECTURE.md §17
--
-- 여기서 하지 않는 것
--   * created_by 추가 — 0001_schema.sql에 이미 있다 (FK sessions_created_by_fkey).
--     재추가하면 42701로 이 파일 전체가 롤백된다
--   * status 컬럼 — 취소는 기존 canceled_at / cancel_reason으로 표현한다.
--     같은 사실을 두 곳에 저장하면 반드시 어긋난다 (§17)
--   * RLS 정책 변경 — 별도 티켓 T46
--   * enable row level security — sessions는 0001에서 이미 켜졌고 실제 DB도 true다.
--     RLS 활성화의 정보원은 0001 하나로 유지한다. 여기서 다시 적으면 정보원이 둘이 된다
--   * generated column — timestamptz +/- interval 은 STABLE이라 생성 열로 쓸 수 없다
--     (0001_schema.sql의 opens_at/closes_at 주석과 같은 이유)

alter table public.sessions
  add column session_type text not null default 'regular'
    check (session_type in ('regular', 'flash'));

-- 개설자 기준 조회용
create index sessions_created_by_idx
  on public.sessions (created_by);

-- T43의 "1인 동시 오픈 1개" 검사가 훑을 후보 집합을 좁힌다.
--
-- unique를 붙이지 않는다. canceled_at is null 은 "취소되지 않음"이지
-- "아직 진행 중"이 아니다. 이미 끝난 과거 번개도 이 predicate에 걸리므로,
-- unique로 만들면 번개를 한 번 연 회원이 영구히 재개설 불가가 된다.
--
-- "아직 종료되지 않음"은 meet_at + open_after_min 과 now()의 비교다.
-- now()는 IMMUTABLE이 아니라 index predicate에 쓸 수 없다.
-- 따라서 동시 오픈 1개 제한은 DB 제약으로 표현할 수 없고
-- T43 Server Action이 판정한다 (§17).
create index sessions_flash_open_idx
  on public.sessions (created_by, meet_at)
  where session_type = 'flash' and canceled_at is null;
