// KST 시계 표기. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// lib/gate.ts는 '06:40' 같은 문자열을 호출자에게 받는다. 서버 액션(T21)이 그 호출자이고,
// Vercel 함수의 TZ는 UTC라 Intl·toLocaleString·getHours를 쓰면 문구가 실행 환경에 끌려간다.
// 그래서 epoch ms에 9시간을 더한 뒤 UTC 부품으로 읽는다. 한국은 서머타임이 없어
// 오프셋이 고정이고, 이 산술이 어떤 환경에서도 같은 답을 낸다.

const KST_OFFSET_MS = 9 * 60 * 60000

/** `Date`를 KST 'HH:mm'으로. Invalid Date는 RangeError — 조용히 'NaN:NaN'을 내보내지 않는다. */
export function formatKstHHmm(d: Date): string {
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError('유효한 시각이 아닙니다.')
  }
  const shifted = new Date(ms + KST_OFFSET_MS)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// 아래 셋은 T22(다음 세션 조회)가 쓴다. 같은 산술을 쓴다 — Intl·toLocaleString은 여기서도 금지다.

const WEEKDAYS_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

function toKstShifted(d: Date): Date {
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError('유효한 시각이 아닙니다.')
  }
  return new Date(ms + KST_OFFSET_MS)
}

/** KST 요일 번호. 0=일 … 6=토. recurring_schedules.weekdays와 같은 규약이다. */
export function kstWeekday(d: Date): number {
  return toKstShifted(d).getUTCDay()
}

/** `Date`를 KST 요일 이름('일요일'~'토요일')으로. Invalid Date는 RangeError. */
export function formatKstWeekday(d: Date): string {
  return WEEKDAYS_KO[kstWeekday(d)]
}

/** `Date`를 KST 기준 'YYYY-MM-DD'로. recurring_schedules.active_from/until(date)과 문자열로 비교할 수 있다. */
export function kstDateString(d: Date): string {
  const s = toKstShifted(d)
  const y = String(s.getUTCFullYear()).padStart(4, '0')
  const m = String(s.getUTCMonth() + 1).padStart(2, '0')
  const day = String(s.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
// PostgREST는 time 컬럼을 'HH:MM:SS'로 준다. 초는 받되 버린다 — 세션 시각은 분 단위다.
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2})?$/

/**
 * KST 벽시계 'YYYY-MM-DD' + 'HH:MM[:SS]' → 그 순간의 Date. 초는 버린다.
 * 형식이 틀리거나(정규식) 범위를 벗어나거나(25시, 02-30) 존재하지 않는 날짜면 RangeError.
 * Date.UTC는 02-30을 조용히 03-02로 넘기므로 왕복해서 같은 날짜인지 확인한다.
 */
export function kstDateTime(date: string, time: string): Date {
  const dm = DATE_RE.exec(date)
  const tm = TIME_RE.exec(time)
  if (!dm || !tm) {
    throw new RangeError('날짜·시각 형식이 올바르지 않습니다.')
  }
  const hh = Number(tm[1])
  const mm = Number(tm[2])
  if (hh > 23 || mm > 59) {
    throw new RangeError('시각이 범위를 벗어났습니다.')
  }
  const utcMs = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hh, mm)
  const result = new Date(utcMs - KST_OFFSET_MS)
  if (kstDateString(result) !== date) {
    throw new RangeError('존재하지 않는 날짜입니다.')
  }
  return result
}
