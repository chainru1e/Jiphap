// 다음 세션 선택. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
// 조회는 lib/queries/nextSession.ts가 하고, 여기는 고르는 규칙만 있다 (ARCHITECTURE.md §20).
//
// 현재 시각은 반드시 인자로 받는다 (lib/window.ts와 같은 이유). 창 판정은 lib/window.ts만 쓴다 —
// SQL이나 여기서 다시 쓰면 판정 기준이 둘로 갈린다.

import { formatKstHHmm, formatKstWeekday, kstDateString, kstDateTime, kstWeekday } from './kst'
import { getWindow, getWindowState, type WindowState } from './window'

// sessions 컬럼 그대로. canceled_at은 없다 — 취소는 조회가 거르고, 이 모듈은 보지 않는다.
export type SessionRow = {
  id: string
  session_type: 'regular' | 'flash'
  place_name: string
  place_lat: number
  place_lng: number
  radius: number
  meet_at: string
  open_before_min: number
  open_after_min: number
}

// recurring_schedules 컬럼 그대로. is_active는 조회가 거른다.
export type ScheduleRow = {
  weekdays: number[]
  meet_time: string
  active_from: string
  active_until: string | null
}

const DAY_MS = 24 * 60 * 60000
// 주 단위 규칙이라 7일이면 한 바퀴다. 8일을 훑는 것은 오늘 시각이 이미 지난 요일이
// 다음 주 같은 요일로 잡히게 하기 위해서다.
const SCAN_DAYS = 8

function windowStateOf(row: SessionRow, now: Date): WindowState | null {
  let w
  try {
    w = getWindow({
      meetAt: new Date(row.meet_at),
      openBeforeMin: row.open_before_min,
      openAfterMin: row.open_after_min,
    })
  } catch {
    // 창을 만들 수 없는 행(meet_at 손상, open_after_min 음수)은 판정 불가라 건너뛴다.
    // 이 행 하나 때문에 나머지 세션까지 못 고르면 안 된다.
    return null
  }
  return getWindowState(w, now)
}

const typeRank = (r: SessionRow) => (r.session_type === 'regular' ? 0 : 1)
const meetMs = (r: SessionRow) => new Date(r.meet_at).getTime()

/**
 * 메인 화면이 그릴 세션 하나. "가장 가까운 세션"은 창이 아직 안 닫힌 세션이다 —
 * meet_at > now로 고르면 창이 열려 있는 06:52에 06:50 세션이 사라진다.
 *
 * 창이 열린 세션이 있으면 그중 regular 우선 → meet_at 이른 순. 정규 장소에 서 있는 부원
 * 화면에 겹친 번개가 뜨지 않게 하기 위해서다 (§17·§20). 열린 게 없으면 열리기 전 세션 중
 * meet_at 이른 순, 같으면 regular 우선. 'after'는 제외.
 */
export function pickNextSession(rows: SessionRow[], now: Date): SessionRow | null {
  const open: SessionRow[] = []
  const before: SessionRow[] = []

  for (const row of rows) {
    const state = windowStateOf(row, now)
    if (state === 'open') open.push(row)
    else if (state === 'before') before.push(row)
  }

  if (open.length > 0) {
    open.sort((a, b) => typeRank(a) - typeRank(b) || meetMs(a) - meetMs(b))
    return open[0]
  }
  if (before.length > 0) {
    before.sort((a, b) => meetMs(a) - meetMs(b) || typeRank(a) - typeRank(b))
    return before[0]
  }
  return null
}

const isWeekdayIndex = (n: number) => Number.isInteger(n) && n >= 0 && n <= 6

/**
 * 반복 일정에서 now 이후 가장 이른 발생 시각. 표시 전용이다 — 세션 행이 없으면 체크인은
 * 어차피 no_session으로 거부된다 (§19). 0~6 밖의 요일 값은 무시한다.
 */
export function nextOccurrence(schedules: ScheduleRow[], now: Date): Date | null {
  const today = kstDateString(now)
  const nowMs = now.getTime()
  let best: Date | null = null

  for (const s of schedules) {
    const weekdays = new Set(s.weekdays.filter(isWeekdayIndex))
    if (weekdays.size === 0) continue

    // active_from은 KST date. 둘 다 'YYYY-MM-DD'라 문자열 비교가 날짜 비교와 같다.
    const startDate = s.active_from > today ? s.active_from : today
    const startMs = kstDateTime(startDate, '00:00').getTime()

    for (let i = 0; i < SCAN_DAYS; i++) {
      const day = new Date(startMs + i * DAY_MS)
      const date = kstDateString(day)
      if (s.active_until !== null && date > s.active_until) break
      if (!weekdays.has(kstWeekday(day))) continue

      const occ = kstDateTime(date, s.meet_time)
      // 엄격히 뒤. 정각에는 이미 세션 행이 있어야 할 시각이지 "다음"이 아니다.
      if (occ.getTime() <= nowMs) continue

      // 날짜 오름차순이라 이 일정의 첫 후보가 곧 가장 이른 후보다.
      if (best === null || occ.getTime() < best.getTime()) best = occ
      break
    }
  }

  return best
}

export const NO_UPCOMING_SESSION = '예정된 집합이 없습니다'

/** 세션이 없을 때 메인 화면이 띄울 문구. "오늘/내일" 같은 상대 표현은 넣지 않는다. */
export function nextSessionNotice(occ: Date | null): string {
  if (occ === null) return NO_UPCOMING_SESSION
  return `다음 집합: ${formatKstWeekday(occ)} ${formatKstHHmm(occ)}`
}
