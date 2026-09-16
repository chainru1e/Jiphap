'use client'

// 지도 또는 레이더 (T19, ARCHITECTURE.md §18).
//
// 폴백 상태(mapFailed)는 여기가 소유한다. KakaoMap은 onError(reason)만 내고 Radar를 모른다.
// 거리·방위 계산은 하지 않는다 — 부모가 lib/geo.ts로 계산해 넘긴 값을 그대로 그린다.
// 지도와 레이더 어느 쪽이 보이든 출석 게이트는 이 컴포넌트 밖에 있고 영향받지 않는다.

import { useState } from 'react'

import KakaoMap, { type KakaoMapErrorReason } from '@/components/KakaoMap'
import Radar from '@/components/Radar'
import type { LatLng } from '@/lib/geo'

export interface MapOrRadarProps {
  center: LatLng
  radius: number
  me: LatLng | null
  accuracy: number | null
  inside: boolean
  distance: number | null // 집합 장소까지 거리 m. 위치가 아직 없으면 null
  bearing: number // 방위각 0~360. 위치가 없으면 부모가 0을 넘긴다
  className?: string
}

export default function MapOrRadar({
  center,
  radius,
  me,
  accuracy,
  inside,
  distance,
  bearing,
  className,
}: MapOrRadarProps) {
  const [mapFailed, setMapFailed] = useState<KakaoMapErrorReason | null>(null)
  // "지도 다시 시도"는 key를 바꿔 KakaoMap을 리마운트한다. 자동 재시도는 두지 않는다 —
  // 체크인 도중 지도가 갑자기 돌아오면 레이아웃이 튀어 버튼을 잘못 누른다 (§18).
  const [retryKey, setRetryKey] = useState(0)

  if (mapFailed === null) {
    return (
      <KakaoMap
        key={retryKey}
        center={center}
        radius={radius}
        me={me}
        accuracy={accuracy}
        inside={inside}
        className={className}
        onError={setMapFailed}
      />
    )
  }

  const retry = () => {
    setMapFailed(null)
    setRetryKey((k) => k + 1)
  }

  return (
    // KakaoMap과 같은 박스 크기를 유지해 전환 시 아래 버튼이 움직이지 않게 한다.
    <div
      className={`relative flex flex-col items-center justify-center gap-3 bg-neutral-200 p-4 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 ${className ?? 'h-80 w-full'}`}
    >
      <p className="text-center">
        지도를 불러오지 못했어요. 레이더로 표시합니다.{' '}
        {/* 폴백 이유는 개발 확인용. 사용자에게 의미 있는 말은 아니므로 작게 둔다. */}
        <span className="text-xs text-neutral-500 dark:text-neutral-400">({mapFailed})</span>
      </p>
      {distance === null ? (
        <p>위치를 기다리는 중입니다</p>
      ) : (
        <Radar distance={distance} bearing={bearing} accuracy={accuracy ?? 0} radius={radius} size={160} />
      )}
      <button
        type="button"
        onClick={retry}
        className="min-h-12 min-w-12 rounded-lg bg-neutral-700 px-4 font-bold text-white dark:bg-neutral-300 dark:text-neutral-900"
      >
        지도 다시 시도
      </button>
    </div>
  )
}
