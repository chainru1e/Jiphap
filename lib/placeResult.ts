// 장소 등록 Server Action(actions/places.ts)의 반환 형태와 그 순수 부분. React·Supabase·브라우저 API를
// import하지 않는다 — lib/checkInResult.ts와 같은 이유로, 쿠키·DB에 묶인 액션 본체에서 순수하게
// 판정할 수 있는 입력 검증을 여기로 뺀다. 'use server' 파일은 async 함수만 export할 수 있어
// 타입·상수도 여기 둔다.
//
// 좌표를 저장 목적으로 받는 유일한 경로다 (ARCHITECTURE.md §23). 게이트 판정과 무관하고,
// 정확도(accuracy)는 받지 않는다 — places에 그런 컬럼이 없고, 정확도로 저장을 막지도 않는다 (§5).

// 슬라이더(클라이언트)와 검증(서버)이 같은 값을 써야 "슬라이더로 고른 값이 서버에서 거부"되는
// 일이 없다. DB CHECK는 20~300이지만 여기서는 보수적으로 200까지만 연다 (T28 슬라이더와 같은 범위).
export const PLACE_RADIUS_MIN = 20
export const PLACE_RADIUS_MAX = 200
export const PLACE_RADIUS_DEFAULT = 60
export const PLACE_NAME_MAX = 40

// 클라이언트가 액션에 보내는 것. created_by·id·is_active는 없다 — 서버가 정한다.
export type CreatePlaceInput = {
  name: string
  lat: number
  lng: number
  radius: number
}

export type SetPlaceActiveInput = {
  id: string
  isActive: boolean
}

export type PlaceFailReason = 'invalid_input' | 'unauthorized' | 'db_error'

export type PlaceActionResult =
  | { ok: true; id: string }
  | { ok: false; reason: PlaceFailReason; message: string }

// 실패 문구는 버튼 위 한 줄에 그대로 뜬다. 어떤 reason에도 빈 문자열이 없어야 한다.
export const PLACE_MESSAGES = {
  invalid_input: '요청이 올바르지 않습니다. 화면을 새로고침해 주세요.',
  // 인증 없음·미승인·일반 회원을 구분하지 않는다. 운영자가 아닌 사람이 이 화면에 오면 proxy가
  // 먼저 돌려보내므로, 여기 도달했다면 직접 POST이고 자세한 사유를 줄 이유가 없다.
  unauthorized: '운영자만 장소를 등록할 수 있습니다.',
  // 원인은 서버 로그에만 남긴다. 클라이언트에 DB 에러 원문을 보내지 않는다.
  db_error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
} as const

// gen_random_uuid()가 만드는 형태. 버전 비트까지 보지는 않는다 — 조회 키일 뿐이고 어차피 DB가 다시 본다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isFiniteInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

/**
 * createPlace 입력의 형태 검사. zod가 없어 손으로 거른다 (actions/check-in.ts와 같은 방식).
 * name은 trim한 길이로 1~40자, radius는 정수 20~200. 형태가 맞아도 인가는 액션이 따로 본다.
 */
export function isCreatePlaceInput(raw: unknown): raw is CreatePlaceInput {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  if (typeof r.name !== 'string') return false
  const len = r.name.trim().length
  return (
    len >= 1 &&
    len <= PLACE_NAME_MAX &&
    isFiniteInRange(r.lat, -90, 90) &&
    isFiniteInRange(r.lng, -180, 180) &&
    typeof r.radius === 'number' &&
    Number.isInteger(r.radius) &&
    r.radius >= PLACE_RADIUS_MIN &&
    r.radius <= PLACE_RADIUS_MAX
  )
}

/** setPlaceActive 입력의 형태 검사. id는 uuid 형태, isActive는 boolean. */
export function isSetPlaceActiveInput(raw: unknown): raw is SetPlaceActiveInput {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  return typeof r.id === 'string' && UUID_RE.test(r.id) && typeof r.isActive === 'boolean'
}
