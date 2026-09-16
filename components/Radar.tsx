// SVG 레이더. props만 받는 순수 컴포넌트 — 훅·상태·Supabase가 없다.
// 지도 타일이 안 올 때의 폴백이라, 좌표만 있으면 무조건 그려져야 한다 (ARCHITECTURE.md §9).
//
// 정확도(accuracy)는 반투명 원으로 보여 주기만 한다. 반경 원의 색은 distance만 본다 —
// 정확도를 이유로 출첵을 막지 않는 것과 같은 원칙이다 (§5). 이 컴포넌트가 판정을 하지 않는다.
//
// 색은 Tailwind 클래스가 아니라 currentColor·인라인 값이다. 테스트 환경이나 다른
// 컨텍스트에서 CSS 없이 렌더해도 같은 그림이 나와야 하고, 회색·십자는 currentColor라
// 다크모드에서 글자색을 따라간다.

import { scaleM, toSvgPoint } from '@/lib/radarGeom'

export interface RadarProps {
  distance: number // 집합 장소까지 거리 m
  bearing: number // 방위각 0~360, 북=0 시계방향
  accuracy: number // GPS 오차 m
  radius: number // 세션 반경 m
  size?: number // px, 기본 240
}

// 색은 두 축만: 대기(반경 밖) · 활성(반경 안). ARCHITECTURE.md §10.
const ACTIVE = '#16a34a'
const WAITING = '#d97706'

export default function Radar({
  distance,
  bearing,
  accuracy,
  radius,
  size = 240,
}: RadarProps) {
  const c = size / 2
  const outerR = c - 8
  const inside = distance <= radius
  const color = inside ? ACTIVE : WAITING
  const me = toSvgPoint({ distance, bearing, radius, size })

  return (
    <svg
      role="img"
      aria-label={`집합 장소 반경 ${radius}m, 현재 거리 ${Math.round(distance)}m`}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
    >
      {/* 바깥 원: radius × 1.2 m. 배경일 뿐이라 얇고 옅게. */}
      <circle
        cx={c}
        cy={c}
        r={outerR}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
        strokeWidth={1}
      />
      {/* 반경 원: 안이면 실선, 밖이면 점선. 이 구분이 화면에서 가장 먼저 읽혀야 한다. */}
      <circle
        cx={c}
        cy={c}
        r={scaleM(radius, radius, size)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeDasharray={inside ? undefined : '6 4'}
      />
      {/* 정확도 원: 내 점을 중심으로. viewBox 밖은 SVG가 알아서 잘라낸다. */}
      <circle
        cx={me.x}
        cy={me.y}
        r={scaleM(accuracy, radius, size)}
        fill={color}
        fillOpacity={0.15}
      />
      {/* 중심 십자: 집합 장소. */}
      <line x1={c - 4} y1={c} x2={c + 4} y2={c} stroke="currentColor" strokeWidth={1.5} />
      <line x1={c} y1={c - 4} x2={c} y2={c + 4} stroke="currentColor" strokeWidth={1.5} />
      {/* 내 점. 반경 × 1.2를 넘으면 toSvgPoint가 가장자리에 고정한다. */}
      <circle cx={me.x} cy={me.y} r={5} fill={color} />
    </svg>
  )
}
