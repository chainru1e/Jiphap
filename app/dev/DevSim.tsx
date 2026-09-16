'use client'

// /dev 조립용: 실제 GPS 또는 슬라이더 값으로 레이더와 더미 버튼을 그린다 (T17).
// 완료 기준 "반경 경계를 넘나들면 버튼이 정확히 그 지점에서 열리고 닫힌다"를 여기서 본다.
// 버튼은 더미다 — onClick이 없고 Server Action을 부르지 않는다. 출첵은 T21·T24의 몫이다.

import { useState } from 'react'

import DistanceSlider from '@/components/DistanceSlider'
import Radar from '@/components/Radar'
import { useGeolocation } from '@/hooks/useGeolocation'
import { accuracyWarning } from '@/lib/accuracy'
import { getGate } from '@/lib/gate'
import { bearingDeg, distanceM, type LatLng } from '@/lib/geo'

// 임의 좌표. 실제 집합 장소가 아니다 — 슬라이더 검증에는 어떤 점이어도 상관없다.
const MEET_POINT: LatLng = { lat: 35.1756, lng: 126.9066 }
const RADIUS_M = 50

// getGate는 now를 인자로 받는다. 여기서 Date.now()를 부르지 않는다 — 창 판정을 재현할
// 이유가 없어 windowState를 'open'으로 고정하고, 인자로만 필요한 opensAt/now도 고정값이다.
const OPENS_AT = new Date('2026-01-01T06:40:00+09:00')
const NOW = new Date('2026-01-01T06:45:00+09:00')
const OPENS_AT_LABEL = '06:40'

export default function DevSim() {
  const [sim, setSim] = useState<number | null>(null)
  const { position, message } = useGeolocation()

  const gpsDist = position ? distanceM(position, MEET_POINT) : null
  const gpsBearing = position ? bearingDeg(position, MEET_POINT) : 0

  // 슬라이더가 켜져 있으면 거리만 바꾸고 방위는 북(0)으로 둔다. 오차 원은 GPS가 있으면
  // 실제 값을, 없으면 0을 쓴다 — 시뮬레이션은 거리 판정을 보는 도구지 오차를 흉내 내지 않는다.
  const dist = sim ?? gpsDist
  const bearing = sim !== null ? 0 : gpsBearing
  const accuracy = position?.accuracy ?? 0

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevSim</h1>
      <div className="max-w-[240px]">
        <DistanceSlider value={sim} onChange={setSim} max={RADIUS_M * 2} />
      </div>

      {dist === null ? (
        <p className="mt-4">{message ?? '위치를 기다리는 중입니다'}</p>
      ) : (
        <DevSimBody dist={dist} bearing={bearing} accuracy={accuracy} source={sim !== null ? '시뮬레이션' : 'GPS'} />
      )}
    </section>
  )
}

function DevSimBody({
  dist,
  bearing,
  accuracy,
  source,
}: {
  dist: number
  bearing: number
  accuracy: number
  source: string
}) {
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
    <div className="mt-4 flex w-[240px] flex-col gap-2">
      <p>
        거리 {Math.round(dist)}m · {source}
      </p>
      <Radar distance={dist} bearing={bearing} accuracy={accuracy} radius={RADIUS_M} />
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
