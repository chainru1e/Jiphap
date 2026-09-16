'use client'

// /dev 조립용: 실제 GPS 좌표로 KakaoMap을 그린다 (T18). 시뮬레이션 슬라이더는 연동하지 않는다.
// 거리 판정은 여기서 한다 — KakaoMap은 inside를 받기만 한다.

import KakaoMap from '@/components/KakaoMap'
import { useGeolocation } from '@/hooks/useGeolocation'
import { distanceM, type LatLng } from '@/lib/geo'

// 임의 좌표. DevSim.tsx와 같은 값이지만 일부러 따로 선언한다 — dev 표시부끼리 import로
// 엮이면 하나를 지울 때 다른 쪽이 깨진다. 실제 집합 장소가 아니다.
const MEET_POINT: LatLng = { lat: 35.1756, lng: 126.9066 }
const RADIUS_M = 50

export default function DevMap() {
  const { position, message } = useGeolocation()
  const inside = position ? distanceM(position, MEET_POINT) <= RADIUS_M : false

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevMap</h1>
      <div className="relative max-w-md">
        <KakaoMap
          center={MEET_POINT}
          radius={RADIUS_M}
          me={position}
          accuracy={position?.accuracy ?? null}
          inside={inside}
        />
        {message && (
          <p className="absolute top-2 right-2 left-2 z-10 rounded bg-white/90 p-2 text-neutral-900 dark:bg-neutral-900/90 dark:text-neutral-100">
            {message}
          </p>
        )}
      </div>
    </section>
  )
}
