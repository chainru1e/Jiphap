'use server'

// 임시 세션 생성 Server Action (T29, ARCHITECTURE.md §24). 운영자가 만드는 schedule_id null ·
// session_type 'regular' 세션의 유일한 쓰기 경로다.
//
// Server Action은 직접 POST로 도달 가능한 공개 엔드포인트다 (§17). proxy.ts의 /admin 가드는
// 화면 전환용이지 방어선이 아니므로 (§15) 인증·status·role을 전부 여기서 다시 본다.
//
// 클라이언트에서 받는 것은 placeId·시각·반경·창 시작(분)뿐이다.
//   * 장소 이름·좌표는 받지 않는다. 스냅샷은 서버가 places에서 복사한다 (§3·§7).
//   * open_after_min은 받지 않는다. 10 고정이다 (§5).
//   * session_type은 받지 않는다. 'regular' 고정이다 — 번개(flash)는 T43의 몫이다 (§17).
//   * created_by는 서버 세션의 user.id다.
// 같은 meet_at의 세션이 있어도 막지 않는다. SELECT로 중복을 검사하지 않는다 (§24 D4).
// console.error에 좌표를 넣지 않는다 (§8).

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  SESSION_MESSAGES,
  SESSION_OPEN_AFTER_MIN,
  isCreateSessionInput,
  isWindowStillOpen,
  parseMeetAtLocal,
  type CreateSessionFailReason,
  type CreateSessionResult,
} from '@/lib/sessionResult'

function fail(reason: CreateSessionFailReason): CreateSessionResult {
  return { ok: false, reason, message: SESSION_MESSAGES[reason] }
}

// actions/places.ts의 authorizeAdmin과 같은 내용이다. 그쪽에서 export해 쓰지 않는 이유:
// 'use server' 파일의 export는 전부 공개 엔드포인트가 된다. 인가 헬퍼를 POST로 부를 수 있게
// 두는 것보다 열다섯 줄 중복이 낫다.
// 인증 + 인가. 통과하면 user.id, 아니면 null. 행 없음·미승인·일반 회원을 구분하지 않는다 (fail-closed).
async function authorizeAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.status !== 'active' || profile?.role !== 'admin') return null

  return user.id
}

export async function createSession(raw: unknown): Promise<CreateSessionResult> {
  if (!isCreateSessionInput(raw)) return fail('invalid_input')
  const { placeId, meetAtLocal, radius, openBeforeMin } = raw

  const userId = await authorizeAdmin()
  if (!userId) return fail('unauthorized')

  // 형태는 맞아도 02-30 같은 날짜는 여기서 걸린다.
  const meetAt = parseMeetAtLocal(meetAtLocal)
  if (!meetAt) return fail('invalid_input')

  // 마감 판정은 서버 시각. 과거 meet_at이라도 마감 전이면 허용한다 (§24 D3).
  if (!isWindowStillOpen(meetAt, openBeforeMin, new Date())) return fail('window_closed')

  // 여기서부터 service_role. 장소는 admin 클라이언트로 읽는다 — 비활성 장소를 골라 보낸 경우를
  // "없는 장소"와 같이 취급하되, 조회 자체의 실패와는 구분한다.
  const admin = createAdminClient()
  const { data: place, error: placeError } = await admin
    .from('places')
    .select('id, name, lat, lng, is_active')
    .eq('id', placeId)
    .maybeSingle()

  if (placeError) {
    console.error('[create-session] place query failed', { placeId, code: placeError.code })
    return fail('db_error')
  }
  if (!place || !place.is_active) return fail('place_not_found')

  // 스냅샷은 서버가 복사한다 (§7). 장소를 나중에 옮겨도 이 세션의 판정 근거는 그대로다.
  const { data, error } = await admin
    .from('sessions')
    .insert({
      place_id: place.id,
      schedule_id: null,
      place_name: place.name,
      place_lat: place.lat,
      place_lng: place.lng,
      radius,
      meet_at: meetAt.toISOString(),
      open_before_min: openBeforeMin,
      open_after_min: SESSION_OPEN_AFTER_MIN,
      session_type: 'regular',
      created_by: userId,
    })
    .select('id, meet_at')
    .single()

  if (error || !data) {
    // 원문은 서버 로그까지만. 좌표는 넣지 않는다.
    console.error('[create-session] insert failed', { placeId, code: error?.code, message: error?.message })
    return fail('db_error')
  }

  // 메인의 getNextSession 결과가 바뀐다. /admin/sessions/new 자체에는 갱신할 목록이 없다.
  revalidatePath('/')
  return { ok: true, id: data.id, meetAt: data.meet_at }
}
