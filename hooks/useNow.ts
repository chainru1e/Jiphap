'use client'

// 표시용 1초 시계 (T24). 표시용 시계다 — 최종 판정은 서버 게이트(T21)가 서버 시각으로 한다.
//
// useGeolocation과 같은 useSyncExternalStore 패턴이다. 스냅샷은 초 단위로 내린 epoch ms라
// 같은 초 안에서는 값이 같고 React가 리렌더하지 않는다. 렌더 중 Date.now()를 직접 부르지
// 않는다 — 렌더가 순수해야 하고(react-hooks/purity), 서버 렌더에서는 시계를 읽지 않아야
// 서버·클라이언트 HTML이 어긋나지 않는다. 그래서 서버 스냅샷은 고정값 0이다.

import { useMemo, useSyncExternalStore } from 'react'

/** 초 단위로 내린 현재 epoch ms. 같은 초 안에서는 같은 값이다. */
export function nowSnapshotMs(): number {
  return Math.floor(Date.now() / 1000) * 1000
}

/** intervalMs마다 onChange를 부르는 구독 함수를 만든다. 해제하면 인터벌을 끈다. */
export function subscribeEvery(intervalMs: number) {
  return (onChange: () => void) => {
    const id = setInterval(onChange, intervalMs)
    return () => clearInterval(id)
  }
}

// 서버 렌더에서는 Date.now()를 부르지 않는다. 화면에는 드러나지 않는다 — 서버에는 위치가
// 없어 게이트를 부르지 않고, /dev는 sim.now를 넘긴다 (components/MainScreen.tsx).
const serverSnapshot = () => 0

export function useNow(intervalMs = 1000): Date {
  // subscribe가 렌더마다 새 함수면 useSyncExternalStore가 매번 재구독한다.
  const subscribe = useMemo(() => subscribeEvery(intervalMs), [intervalMs])
  const ms = useSyncExternalStore(subscribe, nowSnapshotMs, serverSnapshot)
  // 같은 초 안에서는 같은 Date 참조를 돌려줘 아래 게이트 계산이 불필요하게 다시 돌지 않게 한다.
  return useMemo(() => new Date(ms), [ms])
}
