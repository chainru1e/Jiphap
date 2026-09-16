// 레이더의 극좌표→SVG 좌표 변환. 순수 함수만 둔다 — React·Supabase·브라우저 API를
// import하지 않는다. 컴포넌트(components/Radar.tsx)는 렌더 테스트 환경이 없으므로,
// 점이 어디에 찍히는지는 전부 여기서 테스트로 고정한다.

/** 바깥 원과 viewBox 가장자리 사이 여백(px). 점이 가장자리에 고정돼도 잘리지 않게 한다. */
export const RADAR_MARGIN_PX = 8

/** 바깥 원이 대응하는 거리 = radius × 이 값. 반경 밖에 있어도 "얼마나 밖인지"가 보여야 한다. */
export const RADAR_RANGE_FACTOR = 1.2

export type RadarFrame = {
  /** 세션 반경(m). DB check로 20~300에 묶여 있어 0 나눗셈 가드는 두지 않는다. */
  radius: number
  /** SVG 한 변(px). viewBox는 0 0 size size, 중심은 size/2. */
  size: number
}

/** m → px. 바깥 원 반지름(size/2 − 여백)이 radius × 1.2 m에 대응하도록 선형 스케일. */
export function scaleM(meters: number, radius: number, size: number): number {
  const outerPx = size / 2 - RADAR_MARGIN_PX
  return (meters * outerPx) / (radius * RADAR_RANGE_FACTOR)
}

/**
 * 내 점의 SVG 좌표. bearing은 북=0, 시계방향 0~360 (lib/geo.ts bearingDeg 관례).
 * SVG는 y가 아래로 커지므로 북은 −y다.
 *
 * 거리는 radius × 1.2에서 자른다 — 그보다 멀면 가장자리에 고정된다.
 * distance 0이면 r=0이라 bearing과 무관하게 중심에 온다. bearingDeg가 동일 지점에서
 * 내놓는 0은 "북"이 아니라 "미정의"인데, 그 판단을 여기서 따로 하지 않아도 되는 이유다.
 */
export function toSvgPoint({
  distance,
  bearing,
  radius,
  size,
}: RadarFrame & { distance: number; bearing: number }): { x: number; y: number } {
  const c = size / 2
  const clamped = Math.min(distance, radius * RADAR_RANGE_FACTOR)
  const r = scaleM(clamped, radius, size)
  const theta = (bearing * Math.PI) / 180
  return { x: c + r * Math.sin(theta), y: c - r * Math.cos(theta) }
}
