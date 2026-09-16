'use client'

// 카카오맵 + 반경 원 + 집합 마커 + 내 위치 + 오차 원 (T18).
//
// 이 컴포넌트는 그리기만 한다. 거리·판정은 하지 않는다 — inside를 props로 받는다.
// 판정이 lib/gate.ts 한 곳에만 있어야 화면과 서버의 기준이 갈라지지 않는다 (ARCHITECTURE.md §5).
// 그래서 lib/geo.ts에서 가져오는 것은 LatLng 타입뿐이고, 빌드에서 사라진다.
//
// SDK 로드 실패는 onError(reason)로만 알린다 (T19, ARCHITECTURE.md §18). 폴백 상태와
// 레이더 전환은 부모(MapOrRadar)가 소유한다 — 이 컴포넌트는 Radar의 존재를 모른다.

import { useEffect, useRef, useState } from 'react'

import type { LatLng } from '@/lib/geo'

// script: sdk.js 태그 onerror · timeout: timeoutMs 안에 kakao.maps.load 콜백 미도달
// sdk: 태그는 로드됐는데 window.kakao.maps가 없음
export type KakaoMapErrorReason = 'script' | 'timeout' | 'sdk'

export interface KakaoMapProps {
  center: LatLng
  radius: number
  me: LatLng | null
  accuracy: number | null
  inside: boolean
  className?: string
  onError?: (reason: KakaoMapErrorReason) => void
  timeoutMs?: number
}

type Status = 'loading' | 'ready'

const DEFAULT_TIMEOUT_MS = 8000

// 같은 페이지에 KakaoMap이 여럿이어도 script는 하나다. SDK를 두 번 실행하면 전역이 깨진다.
const SCRIPT_ID = 'kakao-map-sdk'

// 색은 두 축만: 대기(반경 밖) · 활성(반경 안). components/Radar.tsx와 같은 값.
const ACTIVE = '#16a34a'
const WAITING = '#d97706'

// 키 미설정은 배포 설정 오류라 onError의 세 사유에 넣지 않는다. 레이더로 넘겨서 가릴
// 일이 아니고, 개발자가 바로 봐야 한다.
const KEY_MISSING_MESSAGE = '지도 키가 설정되지 않았습니다'

function sdkSrc(key: string): string {
  // autoload=false: 스크립트 실행과 지도 초기화를 분리해야 load 콜백에서 컨테이너를 잡을 수 있다.
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`
}

function sdkLoaded(): boolean {
  return typeof kakao !== 'undefined' && typeof kakao.maps !== 'undefined'
}

export default function KakaoMap({
  center,
  radius,
  me,
  accuracy,
  inside,
  className,
  onError,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: KakaoMapProps) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  const keyMissing = !key

  // 키가 없으면 script를 만들지 않는다. 로드 effect가 `if (!key) return`으로 빠진다.
  const [status, setStatus] = useState<Status>('loading')

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const markerRef = useRef<kakao.maps.Marker | null>(null)
  const circleRef = useRef<kakao.maps.Circle | null>(null)
  const meOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null)
  const meDotRef = useRef<HTMLDivElement | null>(null)
  const accCircleRef = useRef<kakao.maps.Circle | null>(null)
  // 내 위치가 처음 잡혔을 때 한 번만 화면을 맞춘다. 매번 맞추면 걸어오는 동안 지도가 계속 튄다.
  const fittedRef = useRef(false)
  // onError는 인스턴스당 한 번만. script 에러와 타임아웃이 겹쳐 두 번 불리면 부모가
  // 폴백 이유를 두 번 갱신하고, 리마운트 뒤 늦게 온 콜백이 새 인스턴스를 오염시킨다.
  const erroredRef = useRef(false)

  // 지도 생성은 SDK 로드 뒤 비동기로 일어난다. 그 시점의 최신 props를 보기 위한 ref.
  // onError도 여기 둔다 — 부모가 매 렌더 새 함수를 넘겨도 effect가 다시 돌지 않게.
  const latestRef = useRef({ center, radius, inside, onError })
  useEffect(() => {
    latestRef.current = { center, radius, inside, onError }
  })

  // SDK 로드 + 지도 생성. 마운트에 한 번.
  useEffect(() => {
    if (!key) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const existing = document.getElementById(SCRIPT_ID)
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : (() => {
            const s = document.createElement('script')
            s.id = SCRIPT_ID
            s.src = sdkSrc(key)
            s.async = true
            document.head.appendChild(s)
            return s
          })()

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const fail = (reason: KakaoMapErrorReason) => {
      clearTimer()
      if (cancelled || erroredRef.current) return
      erroredRef.current = true
      latestRef.current.onError?.(reason)
    }

    const onReady = () => {
      clearTimer()
      // 태그는 로드됐는데 전역이 없다 — 차단 확장이 빈 응답을 돌려줬거나 키가 거부됐을 때.
      if (!sdkLoaded()) {
        fail('sdk')
        return
      }
      kakao.maps.load(() => {
        if (cancelled || !containerRef.current) return
        const { center, radius, inside } = latestRef.current
        const color = inside ? ACTIVE : WAITING
        const centerLL = new kakao.maps.LatLng(center.lat, center.lng)
        const map = new kakao.maps.Map(containerRef.current, { center: centerLL, level: 3 })
        markerRef.current = new kakao.maps.Marker({ position: centerLL, map })
        circleRef.current = new kakao.maps.Circle({
          center: centerLL,
          radius,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.9,
          fillColor: color,
          fillOpacity: 0.15,
          map,
        })
        mapRef.current = map
        // 컨테이너가 렌더 직후 크기를 잡기 전에 생성됐을 수 있다. 타일을 다시 깐다.
        map.relayout()
        setStatus('ready')
      })
    }
    const onScriptError = () => {
      // 실패한 태그가 남아 있으면 다음 인스턴스가 재사용해 error 이벤트를 못 받고
      // 로딩 상태에 갇힌다. 지워 두면 다음 마운트가 새 태그로 다시 시도한다.
      script.remove()
      fail('script')
    }
    const onTimeout = () => {
      // 응답이 없는 태그도 같은 이유로 지운다. 남겨두면 "지도 다시 시도"가 그 태그에
      // 리스너만 다시 붙여 또 timeoutMs를 기다린다.
      script.remove()
      fail('timeout')
    }

    // script가 이미 있고 실행까지 끝났으면 load 이벤트는 다시 오지 않는다.
    // 실패한 script는 onScriptError/onTimeout이 지우므로 재사용되지 않는다.
    if (sdkLoaded()) {
      onReady()
    } else {
      script.addEventListener('load', onReady)
      script.addEventListener('error', onScriptError)
      timer = setTimeout(onTimeout, timeoutMs)
    }

    return () => {
      cancelled = true
      clearTimer()
      script.removeEventListener('load', onReady)
      script.removeEventListener('error', onScriptError)
      // 언마운트에서는 script를 제거하지 않는다. 다시 붙이면 SDK가 두 번 실행되고,
      // 다른 인스턴스가 쓰고 있을 수 있다. 제거는 로드 실패·타임아웃 때만 한다.
      markerRef.current?.setMap(null)
      circleRef.current?.setMap(null)
      meOverlayRef.current?.setMap(null)
      accCircleRef.current?.setMap(null)
      markerRef.current = null
      circleRef.current = null
      meOverlayRef.current = null
      meDotRef.current = null
      accCircleRef.current = null
      mapRef.current = null
    }
  }, [key, timeoutMs])

  // props 갱신. 지도를 다시 만들지 않고 오버레이만 옮긴다.
  const meLat = me?.lat ?? null
  const meLng = me?.lng ?? null
  const centerLat = center.lat
  const centerLng = center.lng
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    const circle = circleRef.current
    if (status !== 'ready' || !map || !marker || !circle) return

    const color = inside ? ACTIVE : WAITING
    const centerLL = new kakao.maps.LatLng(centerLat, centerLng)
    marker.setPosition(centerLL)
    circle.setPosition(centerLL)
    circle.setRadius(radius)
    circle.setOptions({ strokeColor: color, fillColor: color })

    if (meLat === null || meLng === null) {
      meOverlayRef.current?.setMap(null)
      accCircleRef.current?.setMap(null)
      return
    }

    const meLL = new kakao.maps.LatLng(meLat, meLng)
    if (!meOverlayRef.current) {
      const dot = document.createElement('div')
      dot.style.cssText =
        'width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-sizing:border-box;box-shadow:0 0 0 1px rgba(0,0,0,0.25)'
      meDotRef.current = dot
      meOverlayRef.current = new kakao.maps.CustomOverlay({ position: meLL, content: dot, zIndex: 2 })
    }
    if (!accCircleRef.current) {
      accCircleRef.current = new kakao.maps.Circle({
        center: meLL,
        radius: accuracy ?? 0,
        strokeWeight: 0,
        fillColor: color,
        fillOpacity: 0.1,
      })
    }
    if (meDotRef.current) meDotRef.current.style.backgroundColor = color
    meOverlayRef.current.setPosition(meLL)
    meOverlayRef.current.setMap(map)
    accCircleRef.current.setPosition(meLL)
    accCircleRef.current.setRadius(accuracy ?? 0)
    accCircleRef.current.setOptions({ fillColor: color })
    accCircleRef.current.setMap(map)

    if (!fittedRef.current) {
      const bounds = circle.getBounds()
      bounds.extend(meLL)
      // 네 방향 32px 여백: 내 점이 모서리·카카오 로고에 가리지 않게.
      map.setBounds(bounds, 32, 32, 32, 32)
      fittedRef.current = true
    }
  }, [status, centerLat, centerLng, radius, meLat, meLng, accuracy, inside])

  return (
    <div className={`relative ${className ?? 'h-80 w-full'}`}>
      {/* 카카오 지도는 컨테이너 높이가 0이면 타일을 그리지 않는다. 기본 320px(h-80)을
          여기서 보장하고, 바꾸려면 className으로 높이를 함께 넘긴다. 로딩 중에는 이 회색이 보인다.
          로드 실패 시에는 아무 문구도 그리지 않는다 — onError를 받은 부모가 처리한다. */}
      <div ref={containerRef} className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
      {keyMissing && (
        <p className="absolute inset-0 flex items-center justify-center bg-neutral-200 p-4 text-center text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
          {KEY_MISSING_MESSAGE}
        </p>
      )}
    </div>
  )
}
