import 'server-only'

// 다음 세션 조회 (T22). Server Component가 부른다. 고르는 규칙은 lib/nextSession.ts에 있고,
// 여기는 DB에서 후보를 읽어 넘기는 것뿐이다 (ARCHITECTURE.md §20).
//
// lib/supabase/server.ts로 읽는다 — RLS sessions_read / schedules_read를 그대로 탄다.
// admin 클라이언트는 쓰지 않는다. 읽기에 RLS를 우회할 이유가 없다 (§3).

import {
  nextOccurrence,
  nextSessionNotice,
  pickNextSession,
  type ScheduleRow,
  type SessionRow,
} from '@/lib/nextSession'
import { createClient } from '@/lib/supabase/server'

export type NextSessionResult =
  | { kind: 'session'; session: SessionRow }
  | { kind: 'notice'; message: string }
  | { kind: 'error'; message: string }

// 조회 실패는 "예정된 집합이 없습니다"로 뭉개지 않는다. 다른 문구를 내야 부원이 새로고침할 수 있다.
const LOAD_ERROR_MESSAGE = '세션 정보를 불러오지 못했습니다'

// sessions.open_after_min의 CHECK 상한(0~120). 창이 열려 있을 수 있는 세션은 meet_at이
// 아무리 일러도 now − 120분 이후다. 이 조건은 후보를 좁힐 뿐이고, 창 판정은 SQL에 복제하지
// 않는다 — 최종 판정은 pickNextSession이 lib/window.ts로 한다 (§20).
const MAX_OPEN_AFTER_MIN = 120

export async function getNextSession(now: Date = new Date()): Promise<NextSessionResult> {
  const supabase = await createClient()

  const since = new Date(now.getTime() - MAX_OPEN_AFTER_MIN * 60000).toISOString()
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(
      'id, session_type, place_name, place_lat, place_lng, radius, meet_at, open_before_min, open_after_min',
    )
    .is('canceled_at', null)
    .gte('meet_at', since)
    .order('meet_at', { ascending: true })
    .limit(20)

  if (sessionsError) {
    // 원문은 남기지 않는다. code만으로 종류는 알 수 있다.
    console.error('[next-session] sessions query failed', { code: sessionsError.code })
    return { kind: 'error', message: LOAD_ERROR_MESSAGE }
  }

  const picked = pickNextSession((sessions ?? []) as SessionRow[], now)
  if (picked) return { kind: 'session', session: picked }

  const { data: schedules, error: schedulesError } = await supabase
    .from('recurring_schedules')
    .select('weekdays, meet_time, active_from, active_until')
    .eq('is_active', true)

  if (schedulesError) {
    console.error('[next-session] schedules query failed', { code: schedulesError.code })
    return { kind: 'error', message: LOAD_ERROR_MESSAGE }
  }

  const occ = nextOccurrence((schedules ?? []) as ScheduleRow[], now)
  return { kind: 'notice', message: nextSessionNotice(occ) }
}
