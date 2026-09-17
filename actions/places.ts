'use server'

// 장소 등록·활성 토글 Server Action (T27, ARCHITECTURE.md §23). places의 유일한 쓰기 경로다.
//
// Server Action은 직접 POST로 도달 가능한 공개 엔드포인트다 (§17). proxy.ts의 /admin 가드는
// 화면 전환용이지 방어선이 아니므로 (§15) 인증·status·role을 전부 여기서 다시 본다.
// 클라이언트에서 받는 것은 이름·좌표·반경(생성)과 id·isActive(토글)뿐이다. created_by는 서버
// 세션의 user.id고, id·is_active(생성 시)는 DB default다.
//
// 좌표는 클라이언트 GPS 값을 저장 목적으로 받는 유일한 경로다. check_ins와 달리 places.lat/lng에
// 남긴다 — 이건 운영자 본인이 "여기가 집합 장소"라고 지정한 값이지, §8이 금지하는 부원의 원좌표가
// 아니다. 출첵 게이트 판정과는 무관하다. console.error에도 좌표는 넣지 않는다.
// 정확도는 받지 않는다 — 저장할 컬럼도 없고, 정확도로 저장을 막지도 않는다 (§5).

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  PLACE_MESSAGES,
  isCreatePlaceInput,
  isSetPlaceActiveInput,
  type PlaceActionResult,
  type PlaceFailReason,
} from '@/lib/placeResult'

const PLACES_PATH = '/admin/places'

function fail(reason: PlaceFailReason): PlaceActionResult {
  return { ok: false, reason, message: PLACE_MESSAGES[reason] }
}

// 인증 + 인가. 통과하면 user.id, 아니면 null. 행 없음·미승인·일반 회원을 구분하지 않는다 (fail-closed).
// RLS profiles_self로 본인 행만 읽힌다. 여기서 막히면 아래 admin 클라이언트는 만들지도 않는다.
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

export async function createPlace(raw: unknown): Promise<PlaceActionResult> {
  if (!isCreatePlaceInput(raw)) return fail('invalid_input')
  const { name, lat, lng, radius } = raw

  const userId = await authorizeAdmin()
  if (!userId) return fail('unauthorized')

  // 여기서만 service_role을 쓴다. is_active·created_at은 DB default에 맡긴다.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('places')
    .insert({ name: name.trim(), lat, lng, default_radius: radius, created_by: userId })
    .select('id')
    .single()

  if (error || !data) {
    // 원문은 서버 로그까지만. 좌표는 넣지 않는다.
    console.error('[places] insert failed', { code: error?.code, message: error?.message })
    return fail('db_error')
  }

  // 같은 응답에 /admin/places의 RSC payload가 다시 실리므로 목록이 즉시 갱신된다.
  revalidatePath(PLACES_PATH)
  return { ok: true, id: data.id }
}

export async function setPlaceActive(raw: unknown): Promise<PlaceActionResult> {
  if (!isSetPlaceActiveInput(raw)) return fail('invalid_input')
  const { id, isActive } = raw

  const userId = await authorizeAdmin()
  if (!userId) return fail('unauthorized')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('places')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[places] update failed', { id, code: error.code, message: error.message })
    return fail('db_error')
  }
  // 0행이면 목록이 낡은 것이다(그 사이 지워졌거나 없는 id). DB 실패가 아니라 "새로고침해 주세요"다.
  if (!data) return fail('invalid_input')

  revalidatePath(PLACES_PATH)
  return { ok: true, id: data.id }
}
