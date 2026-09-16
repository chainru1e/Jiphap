// 카카오맵 길찾기 버튼 (T20). 상태가 없어 'use client'가 필요 없다.
//
// 거리 계산·위치 훅을 import하지 않는다. 목적지 좌표를 받아 링크를 만드는 것이 전부다.
// URL 규칙(스킴·출발지 생략·도보 고정)은 lib/kakaoLink.ts 한 곳에만 있다.

import type { LatLng } from '@/lib/geo'
import { routeUrl } from '@/lib/kakaoLink'

export interface DirectionsButtonProps {
  dest: LatLng
  className?: string
}

export default function DirectionsButton({ dest, className }: DirectionsButtonProps) {
  return (
    // target="_blank": 같은 탭에서 열면 출첵 화면이 사라지고, 카카오맵에서 돌아오면
    // 위치 권한과 GPS를 처음부터 다시 잡는다. 7시에 그 대기는 실패다.
    // 색은 중립으로 둔다 — 대기/활성 두 축은 반경 판정에만 쓴다 (ARCHITECTURE.md §10).
    <a
      href={routeUrl(dest)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-neutral-800 px-4 font-bold text-white dark:bg-neutral-200 dark:text-neutral-900 ${className ?? ''}`}
    >
      길찾기
    </a>
  )
}
