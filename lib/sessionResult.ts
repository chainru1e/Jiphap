// 임시 세션 생성 Server Action(actions/create-session.ts)의 반환 형태와 그 순수 부분.
// React·Supabase·브라우저 API를 import하지 않는다 — lib/placeResult.ts와 같은 이유로, 쿠키·DB에 묶인
// 액션 본체에서 순수하게 판정할 수 있는 입력 검증·시각 해석·마감 판정을 여기로 뺀다.
//
// 시각은 datetime-local 값('YYYY-MM-DDTHH:mm', KST 벽시계)을 그대로 받고 lib/kst.ts가 Date로 바꾼다.
// KST 산술은 kst.ts 한 곳에만 있다 — 여기서 +09:00을 직접 더하지 않는다.
// 창 종료는 meet_at + 10분 고정이다 (ARCHITECTURE.md §5). 폼에도 입력에도 open_after_min은 없다.

import { kstDateTime } from './kst'
import { PLACE_RADIUS_MAX, PLACE_RADIUS_MIN } from './placeResult'
import { getWindow } from './window'

// §5 — 운영자도 바꾸지 않는다. 서버가 INSERT에 이 값을 박는다.
export const SESSION_OPEN_AFTER_MIN = 10
// sessions.open_before_min CHECK(0~120)와 같은 범위. 기본 10은 DB default와 같다.
export const OPEN_BEFORE_MIN = 0
export const OPEN_BEFORE_MAX = 120
export const OPEN_BEFORE_DEFAULT = 10

// 클라이언트가 액션에 보내는 것. 장소 이름·좌표는 없다 — 스냅샷은 서버가 places에서 복사한다 (§7).
export type CreateSessionInput = {
  placeId: string
  meetAtLocal: string // 'YYYY-MM-DDTHH:mm' (KST)
  radius: number
  openBeforeMin: number
}

export type CreateSessionFailReason =
  | 'invalid_input'
  | 'unauthorized'
  | 'place_not_found'
  | 'window_closed'
  | 'db_error'

export type CreateSessionResult =
  | { ok: true; id: string; meetAt: string }
  | { ok: false; reason: CreateSessionFailReason; message: string }

// 실패 문구는 버튼 위 한 줄에 그대로 뜬다. 어떤 reason에도 빈 문자열이 없어야 한다.
export const SESSION_MESSAGES = {
  invalid_input: '요청이 올바르지 않습니다. 화면을 새로고침해 주세요.',
  unauthorized: '운영자만 세션을 만들 수 있습니다.',
  place_not_found: '장소를 찾을 수 없습니다. 비활성이거나 삭제된 장소입니다. 화면을 새로고침해 주세요.',
  // 과거 시각이라도 마감 전이면 허용한다. 거부되는 건 "이미 닫힌" 시각뿐이다.
  window_closed: '이미 마감된 시각입니다. 마감 전 시각을 골라 주세요.',
  // 원인은 서버 로그에만 남긴다. 클라이언트에 DB 에러 원문을 보내지 않는다.
  db_error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
} as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// datetime-local이 주는 형태. 초는 받지 않는다 — 세션 시각은 분 단위다.
const MEET_AT_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

/**
 * createSession 입력의 형태 검사. 형태만 본다 — 날짜가 실제로 존재하는지는 parseMeetAtLocal이,
 * 장소가 있는지·마감됐는지는 액션이 판정한다.
 */
export function isCreateSessionInput(raw: unknown): raw is CreateSessionInput {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.placeId === 'string' &&
    UUID_RE.test(r.placeId) &&
    typeof r.meetAtLocal === 'string' &&
    MEET_AT_LOCAL_RE.test(r.meetAtLocal) &&
    isIntInRange(r.radius, PLACE_RADIUS_MIN, PLACE_RADIUS_MAX) &&
    isIntInRange(r.openBeforeMin, OPEN_BEFORE_MIN, OPEN_BEFORE_MAX)
  )
}

/**
 * 'YYYY-MM-DDTHH:mm'(KST 벽시계) → 그 순간의 Date. 형식이 틀리거나 존재하지 않는 날짜·시각이면 null.
 * kstDateTime의 RangeError를 여기서 null로 바꾼다 — 액션이 예외 대신 invalid_input을 돌려주기 위해서다.
 */
export function parseMeetAtLocal(s: string): Date | null {
  if (!MEET_AT_LOCAL_RE.test(s)) return null
  const [date, time] = s.split('T')
  try {
    return kstDateTime(date, time)
  } catch {
    return null
  }
}

/**
 * 창이 아직 안 닫혔는가 — closesAt > now. 과거 meet_at이라도 마감 전이면 true다
 * ("지금 06:50 집합 열자"가 가능해야 한다). 마감 정각(closesAt === now)은 false — lib/window.ts의
 * 반열린 구간과 같은 방향이다. now는 반드시 인자로 받는다 (window.ts와 같은 이유).
 * getWindow가 던지면 false — 판정 불가를 "열림"으로 둔갑시키지 않는다.
 */
export function isWindowStillOpen(meetAt: Date, openBeforeMin: number, now: Date): boolean {
  try {
    const { closesAt } = getWindow({ meetAt, openBeforeMin, openAfterMin: SESSION_OPEN_AFTER_MIN })
    return closesAt.getTime() > now.getTime()
  } catch {
    return false
  }
}
