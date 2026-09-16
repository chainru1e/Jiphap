'use client'

// 카카오맵 + 반경 원 + 집합 마커 + 내 위치 + 오차 원 (T18).
//
// 이 컴포넌트는 그리기만 한다. 거리·판정은 하지 않는다 — inside를 props로 받는다.
// 판정이 lib/gate.ts 한 곳에만 있어야 화면과 서버의 기준이 갈라지지 않는다 (ARCHITECTURE.md §5).
// 그래서 lib/geo.ts에서 가져오는 것은 LatLng 타입뿐이고, 빌드에서 사라진다.
//
// SDK 로드 실패·타임아웃 시 레이더로 넘기는 폴백은 T19다. 여기서는 status만 낸다.

import { useEffect, useRef, useState } from 'react'

import type { LatLng } from '@/lib/geo'

export interface KakaoMapProps {
  center: LatLng
  radius: number
  me: LatLng | null
  accuracy: number | null
  inside: boolean
  className?: string
}

type Status = 'loading' | 'ready' | 'error'

// 같은 페이지에 KakaoMap이 여럿이어도 script는 하나다. SDK를 두 번 실행하면 전역이 깨진다.
const SCRIPT_ID = 'kakao-map-sdk'

// 색은 두 축만: 대기(반경 밖) · 활성(반경 안). components/Radar.tsx와 같은 값.
const ACTIVE = '#16a34a'
const WAITING = '#d97706'

const KEY_MISSING_MESSAGE = '지도 키가 설정되지 않았습니다'
const LOAD_FAILED_MESSAGE = '지도를 불러오지 못했습니다'

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
}: KakaoMapProps) {
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
  const keyMissing = !key

  // 키가 없으면 script를 만들지 않는다. effect 안에서 동기 setState를 하면
  // react-hooks/set-state-in-effect에 걸리므로 초기값으로 결정한다.
  const [status, setStatus] = useState<Status>(keyMissing ? 'error' : 'loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(
    keyMissing ? KEY_MISSING_MESSAGE : null,
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const markerRef = useRef<kakao.maps.Marker | null>(null)
  const circleRef = useRef<kakao.maps.Circle | null>(null)
  const meOverlayRef = useRef<kakao.maps.CustomOverlay | null>(null)
  const meDotRef = useRef<HTMLDivElement | null>(null)
  const accCircleRef = useRef<kakao.maps.Circle | null>(null)
  // 내 위치가 처음 잡혔을 때 한 번만 화면을 맞춘다. 매번 맞추면 걸어오는 동안 지도가 계속 튄다.
  const fittedRef = useRef(false)

  // 지도 생성은 SDK 로드 뒤 비동기로 일어난다. 그 시점의 최신 props를 보기 위한 ref.
  const latestRef = useRef({ center, radius, inside })
  useEffect(() => {
    latestRef.current = { center, radius, inside }
  })

  // SDK 로드 + 지도 생성. 마운트에 한 번.
  useEffect(() => {
    if (!key) return
    let cancelled = false

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

    const onReady = () => {
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
    const onError = () => {
      if (cancelled) return
      setErrorMessage(LOAD_FAILED_MESSAGE)
      setStatus('error')
    }

    // script가 이미 있고 실행까지 끝났으면 load 이벤트는 다시 오지 않는다.
    // 이미 실패한 script를 재사용하는 경우는 잡지 못한다 — 그 처리는 T19 폴백의 몫이다.
    if (sdkLoaded()) {
      onReady()
    } else {
      script.addEventListener('load', onReady)
      script.addEventListener('error', onError)
    }

    return () => {
      cancelled = true
      script.removeEventListener('load', onReady)
      script.removeEventListener('error', onError)
      // script는 제거하지 않는다. 다시 붙이면 SDK가 두 번 실행되고, 다른 인스턴스가 쓰고 있을 수 있다.
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
  }, [key])

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
      map.setBounds(bounds)
      fittedRef.current = true
    }
  }, [status, centerLat, centerLng, radius, meLat, meLng, accuracy, inside])

  return (
    <div className={`relative ${className ?? 'h-80 w-full'}`}>
      {/* 카카오 지도는 컨테이너 높이가 0이면 타일을 그리지 않는다. 기본 320px(h-80)을
          여기서 보장하고, 바꾸려면 className으로 높이를 함께 넘긴다. 로딩 중에는 이 회색이 보인다. */}
      <div ref={containerRef} className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
      {status === 'error' && (
        <p className="absolute inset-0 flex items-center justify-center bg-neutral-200 p-4 text-center text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
