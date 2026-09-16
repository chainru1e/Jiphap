'use client'

// /dev 조립용: 실제 GPS 좌표로 MapOrRadar를 그린다 (T18·T19). 시뮬레이션 슬라이더는 연동하지 않는다.
// 거리·방위 판정은 여기서 한다 — MapOrRadar/KakaoMap은 값을 받기만 한다.
//
// 아래 더미 게이트 버튼은 MapOrRadar 밖에 있다. 지도가 실패해 레이더로 바뀌어도 버튼은
// 거리로만 열리고 닫혀야 한다 (ARCHITECTURE.md §18의 /dev 검증 케이스). onClick은 없다.

import DirectionsButton from '@/components/DirectionsButton'
import MapOrRadar from '@/components/MapOrRadar'
import { useGeolocation } from '@/hooks/useGeolocation'
import { accuracyWarning } from '@/lib/accuracy'
import { getGate } from '@/lib/gate'
import { bearingDeg, distanceM, type LatLng } from '@/lib/geo'

// 임의 좌표. DevSim.tsx와 같은 값이지만 일부러 따로 선언한다 — dev 표시부끼리 import로
// 엮이면 하나를 지울 때 다른 쪽이 깨진다. 실제 집합 장소가 아니다.
const MEET_POINT: LatLng = { lat: 35.1756, lng: 126.9066 }
const RADIUS_M = 50

// getGate는 now를 인자로 받는다. 여기서 Date.now()를 부르지 않는다 — 창 판정을 재현할
// 이유가 없어 windowState를 'open'으로 고정하고, 인자로만 필요한 opensAt/now도 고정값이다.
const OPENS_AT = new Date('2026-01-01T06:40:00+09:00')
const NOW = new Date('2026-01-01T06:45:00+09:00')
const OPENS_AT_LABEL = '06:40'

export default function DevMap() {
  const { position, message } = useGeolocation()
  const dist = position ? distanceM(position, MEET_POINT) : null
  const bearing = position ? bearingDeg(position, MEET_POINT) : 0
  const inside = dist !== null && dist <= RADIUS_M

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevMap</h1>
      <div className="relative max-w-md">
        <MapOrRadar
          center={MEET_POINT}
          radius={RADIUS_M}
          me={position}
          accuracy={position?.accuracy ?? null}
          inside={inside}
          distance={dist}
          bearing={bearing}
        />
        {message && (
          <p className="absolute top-2 right-2 left-2 z-10 rounded bg-white/90 p-2 text-neutral-900 dark:bg-neutral-900/90 dark:text-neutral-100">
            {message}
          </p>
        )}
      </div>
      <DirectionsButton dest={MEET_POINT} className="mt-4" />

      {dist === null ? (
        <p className="mt-4">위치를 기다리는 중입니다</p>
      ) : (
        <DevMapGate dist={dist} accuracy={position?.accuracy ?? 0} />
      )}
    </section>
  )
}

function DevMapGate({ dist, accuracy }: { dist: number; accuracy: number }) {
  const gate = getGate({
    windowState: 'open',
    distM: dist,
    radiusM: RADIUS_M,
    opensAt: OPENS_AT,
    now: NOW,
    opensAtLabel: OPENS_AT_LABEL,
  })
  const warning = accuracyWarning({ accuracy, radius: RADIUS_M })

  return (
    <div className="mt-4 flex max-w-md flex-col gap-2">
      <p>거리 {Math.round(dist)}m</p>
      {/* 경고는 판정을 바꾸지 않는다 (ARCHITECTURE.md §5). 버튼 바로 위에만 띄운다. */}
      {warning && <p className="text-amber-700 dark:text-amber-400">{warning}</p>}
      {/* 비활성 이유가 버튼에 그대로 뜬다. getGate의 message는 비어 있지 않다. */}
      <button
        type="button"
        disabled={!gate.enabled}
        className="min-h-12 rounded-lg px-4 font-bold text-white enabled:bg-green-600 disabled:bg-neutral-400 dark:disabled:bg-neutral-600"
      >
        {gate.message}
      </button>
    </div>
  )
}
