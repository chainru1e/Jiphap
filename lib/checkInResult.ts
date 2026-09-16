// 체크인 Server Action의 반환 형태와 그 순수 부분. React·Supabase·브라우저 API를 import하지 않는다.
//
// 액션 본체(actions/check-in.ts)는 쿠키·DB에 묶여 있어 테스트하기 어렵다. 그래서 "어떤 DB 에러가
// 중복이고 어떤 것이 실패인가"처럼 순수하게 판정할 수 있는 부분을 여기로 뺀다.
//
// 실패 문구는 버튼 바로 위에 그대로 뜬다 (ARCHITECTURE.md §5). 어떤 reason에도 빈 문자열이 없어야
// "왜 안 되지"에 답할 수 있다. 게이트 실패(before_window·too_far·after_window)의 문구는
// lib/gate.ts가 이미 만들어 주므로 여기 두지 않는다 — 두 곳에 두면 반드시 어긋난다.

import type { GateReason } from './gate'

// 클라이언트가 액션에 보내는 것. 시각은 없다 — 출첵 시각은 서버가 정한다.
export type CheckInInput = {
  sessionId: string
  lat: number
  lng: number
  accuracy: number
}

export type CheckInFailReason =
  | 'invalid_input'
  | 'unauthenticated'
  | 'not_active'
  | 'no_session'
  | Exclude<GateReason, 'ok'>
  | 'db_error'

export type CheckInResult =
  | { ok: true; already: false; message: string; distance: number }
  | { ok: true; already: true; message: string }
  | { ok: false; reason: CheckInFailReason; message: string }

// 게이트 밖의 문구. 게이트 문구는 getGate().message를 그대로 쓴다.
export const CHECK_IN_MESSAGES = {
  success: '출석 완료',
  already: '이미 출석 처리됐어요',
  invalid_input: '요청이 올바르지 않습니다. 화면을 새로고침해 주세요.',
  unauthenticated: '로그인이 필요합니다.',
  not_active: '승인된 회원만 출석할 수 있습니다.',
  no_session: '출석할 세션이 없습니다.',
  // 원인은 서버 로그에만 남긴다. 클라이언트에 DB 에러 원문을 보내지 않는다.
  db_error: '기록에 실패했습니다. 잠시 후 다시 시도해 주세요.',
} as const

/**
 * INSERT 에러 코드를 둘로 가른다. 23505(unique_violation)는 "이미 출석했다"이지 실패가 아니다 —
 * UNIQUE(session_id, member_id)가 두 번째 출첵을 막은 것이고, 부원 입장에서는 출석이 되어 있는
 * 상태다. 사전 SELECT로 중복을 검사하지 않는 이유는 두 요청이 겹칠 때 둘 다 통과하기 때문이다.
 * 그 외 코드와 코드 없음은 전부 db_error다. 모르면 실패로 본다.
 */
export function mapInsertError(code: string | undefined): 'already' | 'db_error' {
  return code === '23505' ? 'already' : 'db_error'
}
