'use server'

// 체크인 Server Action (T21). 출첵의 유일한 쓰기 경로다 (ARCHITECTURE.md §3, §4, §19).
//
// Server Action은 직접 POST로 도달 가능한 공개 엔드포인트다 (§17). 화면의 버튼 상태와
// proxy.ts 가드는 방어선이 아니므로, 인증·회원 자격·세션·창·거리를 전부 여기서 다시 판정한다.
// 클라이언트가 보낸 것 중 믿는 값은 없다 — sessionId는 조회 키로만 쓰고, 좌표는 재계산 입력일 뿐이다.
//
// 절대 규칙 (CLAUDE.md)
//   * 출첵 시각은 서버 시각. 클라이언트 시각은 받지도 않는다. checked_at은 DB default now()다.
//   * lat/lng는 저장·로깅하지 않는다. dist_m·accuracy_m만 남긴다 (§8).
//   * 정확도로 거부하지 않는다. accuracy는 기록만 하고 판정에 넣지 않는다 (§5).
//   * 창 밖이면 행을 만들지 않는다. "지각"은 없다 (§5).
//
// 여기서 하지 않는 것: 시트 동기화 after()는 T40, revalidatePath는 T55.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  CHECK_IN_MESSAGES,
  mapInsertError,
  type CheckInFailReason,
  type CheckInInput,
  type CheckInResult,
} from '@/lib/checkInResult'
import { getGate, type GateReason } from '@/lib/gate'
import { distanceM } from '@/lib/geo'
import { formatKstHHmm } from '@/lib/kst'
import { getWindow, getWindowState } from '@/lib/window'

// zod가 없어 손으로 거른다. 형태만 본다 — 형태가 맞아도 sessionId가 남의 세션일 수 있고,
// 그건 아래 조회와 게이트가 판정한다.
function isCheckInInput(raw: unknown): raw is CheckInInput {
  if (typeof raw !== 'object' || raw === null) return false
  const r = raw as Record<string, unknown>
  return (
    typeof r.sessionId === 'string' &&
    r.sessionId.length > 0 &&
    typeof r.lat === 'number' &&
    Number.isFinite(r.lat) &&
    r.lat >= -90 &&
    r.lat <= 90 &&
    typeof r.lng === 'number' &&
    Number.isFinite(r.lng) &&
    r.lng >= -180 &&
    r.lng <= 180 &&
    typeof r.accuracy === 'number' &&
    Number.isFinite(r.accuracy) &&
    r.accuracy >= 0
  )
}

// 게이트 밖의 실패. 게이트 사유는 getGate().message를 그대로 돌려주므로 이 함수를 거치지 않는다.
function fail(reason: Exclude<CheckInFailReason, GateReason>): CheckInResult {
  return { ok: false, reason, message: CHECK_IN_MESSAGES[reason] }
}

export async function checkIn(raw: unknown): Promise<CheckInResult> {
  if (!isCheckInInput(raw)) return fail('invalid_input')
  const { sessionId, lat, lng, accuracy } = raw

  // 1. 인증 — 요청 쿠키의 세션. getUser()는 토큰을 Supabase에 검증시키므로 getSession()보다 믿을 수 있다.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('unauthenticated')

  // 2. 회원 자격 — 행이 없으면 pending으로 본다 (fail-closed, proxy.ts와 같은 규칙).
  //    RLS profiles_self로 본인 행만 읽힌다. 여기서 막히면 아래 admin 클라이언트는 만들지도 않는다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle()
  if ((profile?.status ?? 'pending') !== 'active') return fail('not_active')

  // 3. 세션 — 취소된 세션은 없는 것과 같다 (§3 "세션 존재 · 미취소"). 좌표·반경은 세션에 스냅샷된
  //    값이다 (§7). places를 다시 보지 않는다.
  const { data: session } = await supabase
    .from('sessions')
    .select('place_lat, place_lng, radius, meet_at, open_before_min, open_after_min')
    .eq('id', sessionId)
    .is('canceled_at', null)
    .maybeSingle()
  if (!session) return fail('no_session')

  // 4. 판정 — 시각은 서버의 now, 거리는 서버 재계산. 클라이언트 게이트 결과는 받지 않는다.
  const now = new Date()
  const distM = distanceM({ lat, lng }, { lat: session.place_lat, lng: session.place_lng })

  let gate
  try {
    const w = getWindow({
      meetAt: new Date(session.meet_at),
      openBeforeMin: session.open_before_min,
      openAfterMin: session.open_after_min,
    })
    gate = getGate({
      windowState: getWindowState(w, now),
      distM,
      radiusM: session.radius,
      opensAt: w.opensAt,
      now,
      opensAtLabel: formatKstHHmm(w.opensAt),
    })
  } catch (e) {
    // 반경 0, 음수 창 같은 세션 데이터 손상. 부원 잘못이 아니고 판정 자체가 불가능하므로
    // 거부 사유를 지어내지 않고 실패로 돌린다. 좌표는 로그에 넣지 않는다.
    console.error('[check-in] gate input invalid', { sessionId, error: String(e) })
    return fail('db_error')
  }

  // enabled와 reason === 'ok'는 동치다 (lib/gate.ts). reason으로 분기해야 타입이 좁혀진다.
  if (gate.reason !== 'ok') {
    return { ok: false, reason: gate.reason, message: gate.message }
  }

  // 5. 기록 — 여기서만 service_role을 쓴다. 저장 컬럼은 넷뿐이다. lat/lng는 넣지 않는다.
  //    checked_at·method는 DB default(now(), 'gps')에 맡긴다.
  const admin = createAdminClient()
  const { error } = await admin.from('check_ins').insert({
    session_id: sessionId,
    member_id: user.id,
    dist_m: Math.round(distM),
    accuracy_m: Math.round(accuracy),
  })

  if (error) {
    if (mapInsertError(error.code) === 'already') {
      // UNIQUE(session_id, member_id)에 걸렸다. 부원 입장에서는 출석이 되어 있는 상태다.
      return { ok: true, already: true, message: CHECK_IN_MESSAGES.already }
    }
    // 원문은 서버 로그까지만. 클라이언트에는 코드도 원문도 보내지 않는다.
    console.error('[check-in] insert failed', { sessionId, code: error.code, message: error.message })
    return fail('db_error')
  }

  return { ok: true, already: false, message: CHECK_IN_MESSAGES.success, distance: Math.round(distM) }
}
