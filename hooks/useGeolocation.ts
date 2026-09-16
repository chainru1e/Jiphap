'use client'

// 브라우저 Geolocation watchPosition을 감싸는 훅 (T15).
//
// 이 훅이 주는 좌표는 화면(거리 숫자·버튼 상태·지도)을 위한 것이다. 출첵 성립 여부는
// 서버가 다시 판정한다 (ARCHITECTURE.md §3, §4). 좌표는 state에만 두고 어디에도
// 저장하거나 보내지 않는다 — 원좌표 저장 금지(§8)는 서버만의 규칙이 아니다.
//
// 에러가 나도 watch를 끊지 않는다. 권한을 나중에 허용하거나 신호가 돌아오면 success가
// 다시 불려 저절로 복구된다. 재시도 버튼을 만들지 않는 이유가 이것이다.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { geoErrorKind, geoErrorMessage, type GeoErrorKind } from '@/lib/geoMessage'

export type GeoStatus = 'idle' | 'watching' | GeoErrorKind

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

interface GeoState {
  status: GeoStatus
  position: GeoPosition | null
  message: string | null
}

const INITIAL: GeoState = { status: 'idle', position: null, message: null }
const UNSUPPORTED: GeoState = {
  status: 'unsupported',
  position: null,
  message: geoErrorMessage('unsupported'),
}

// 브라우저가 Geolocation을 지원하는지는 바뀌지 않는 외부 사실이라 구독할 것이 없다.
// 서버 스냅샷을 true로 두어 서버 렌더가 navigator를 만지지 않게 하고, 하이드레이션 뒤
// 클라이언트 스냅샷이 false면 React가 다시 렌더한다. effect 안에서 동기 setState로
// 처리하면 react-hooks/set-state-in-effect에 걸린다.
const subscribeNoop = () => () => {}
const isSupportedOnClient = () => 'geolocation' in navigator
const isSupportedOnServer = () => true

export function useGeolocation(): GeoState {
  const supported = useSyncExternalStore(subscribeNoop, isSupportedOnClient, isSupportedOnServer)
  const [state, setState] = useState<GeoState>(INITIAL)
  // ref에 두는 이유: cleanup이 최신 id를 봐야 하고, id가 바뀌어도 리렌더가 필요 없다.
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (!supported) return

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: 'watching',
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          message: null,
        })
      },
      (err) => {
        const kind = geoErrorKind(err.code)
        // position은 직전 값을 남긴다. 타임아웃 한 번에 화면의 거리 숫자가 사라지면
        // 이미 반경 안에 서 있는 사람의 버튼이 꺼진다.
        setState((prev) => ({
          status: kind,
          position: prev.position,
          message: geoErrorMessage(kind),
        }))
      },
      // maximumAge: 0 — 캐시된 위치는 반경 판정에 쓸 수 없다. 걸어오는 중이기 때문이다.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )

    // 언마운트 시 반드시 clearWatch (CLAUDE.md 코드 규칙). 안 끄면 화면을 떠나도
    // GPS가 켜진 채로 남아 배터리를 먹고, 언마운트된 컴포넌트에 setState가 날아간다.
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [supported])

  return supported ? state : UNSUPPORTED
}
