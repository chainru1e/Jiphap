// /dev 확인용: MainScreen을 하드코딩 세션으로 375×667 프레임 안에 그린다 (T23).
// 완료 기준 "375×667에서 스크롤 없이 전부 보인다"를 여기서 본다 — 넘치면 프레임 안에
// 스크롤바가 생겨 바로 눈에 띈다.
//
// Server Component다. meet_at은 DevMap.tsx와 같은 방식의 고정 상수다 — 렌더 시각을 읽으면
// 렌더가 순수하지 않고, 이 화면은 창 판정을 하지 않아 시각이 실제와 맞을 이유가 없다.

import MainScreen from '@/components/MainScreen'
import type { SessionRow } from '@/lib/nextSession'

// 임의 좌표. DevMap.tsx와 같은 값이지만 일부러 따로 선언한다 — dev 표시부끼리 import로
// 엮이면 하나를 지울 때 다른 쪽이 깨진다. 실제 집합 장소가 아니다.
const MEET_LAT = 35.1756
const MEET_LNG = 126.9066
const RADIUS_M = 50
// 창 판정은 T24 몫이라 어떤 시각이어도 상관없다. 헤더 표기("06:50")만 확인한다.
const MEET_AT = '2026-01-01T06:50:00+09:00'

export default function DevMainScreen() {
  const session: SessionRow = {
    id: 'dev',
    session_type: 'regular',
    place_name: '용봉탑(dev)',
    place_lat: MEET_LAT,
    place_lng: MEET_LNG,
    radius: RADIUS_M,
    meet_at: MEET_AT,
    open_before_min: 10,
    open_after_min: 10,
  }

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevMainScreen (375×667)</h1>
      <div className="h-[667px] w-[375px] overflow-auto ring-1 ring-neutral-400">
        <MainScreen result={{ kind: 'session', session }} />
      </div>
    </section>
  )
}
