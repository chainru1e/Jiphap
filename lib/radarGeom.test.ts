import { describe, expect, it } from 'vitest'

import { scaleM, toSvgPoint } from './radarGeom'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

// size 240 → 중심 120, 바깥 원 112px. radius 100 → 바깥 원 = 120m. 즉 0.9333 px/m.
const FRAME = { radius: 100, size: 240 }
const C = 120
const PX_PER_M = 112 / 120

describe('scaleM', () => {
  it('radius × 1.2 m가 바깥 원 반지름(size/2 − 8)에 대응한다', () => {
    expect(scaleM(120, FRAME.radius, FRAME.size)).toBeCloseTo(112, 6)
  })

  it('0m는 0px다', () => {
    expect(scaleM(0, FRAME.radius, FRAME.size)).toBe(0)
  })

  it('반경 자체는 바깥 원의 1/1.2 지점이다', () => {
    expect(scaleM(100, FRAME.radius, FRAME.size)).toBeCloseTo(112 / 1.2, 6)
  })
})

describe('toSvgPoint', () => {
  // sin(π)는 정확히 0이 아니라 toBeCloseTo로 본다.
  const r50 = 50 * PX_PER_M

  it('북(0)은 중심 위쪽이다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 50, bearing: 0 })
    expect(p.x).toBeCloseTo(C, 6)
    expect(p.y).toBeCloseTo(C - r50, 6)
  })

  it('동(90)은 중심 오른쪽이다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 50, bearing: 90 })
    expect(p.x).toBeCloseTo(C + r50, 6)
    expect(p.y).toBeCloseTo(C, 6)
  })

  it('남(180)은 중심 아래쪽이다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 50, bearing: 180 })
    expect(p.x).toBeCloseTo(C, 6)
    expect(p.y).toBeCloseTo(C + r50, 6)
  })

  it('서(270)는 중심 왼쪽이다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 50, bearing: 270 })
    expect(p.x).toBeCloseTo(C - r50, 6)
    expect(p.y).toBeCloseTo(C, 6)
  })

  it('반경 × 1.2를 넘으면 가장자리에 고정된다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 300, bearing: 270 })
    expect(p.x).toBeCloseTo(8, 6)
    expect(p.y).toBeCloseTo(C, 6)
  })

  it('가장자리 고정은 거리가 더 멀어져도 같은 좌표다', () => {
    const near = toSvgPoint({ ...FRAME, distance: 300, bearing: 45 })
    const far = toSvgPoint({ ...FRAME, distance: 5000, bearing: 45 })
    expect(far.x).toBeCloseTo(near.x, 6)
    expect(far.y).toBeCloseTo(near.y, 6)
  })

  it('정확히 반경 위(경계)는 반경 원 위에 찍힌다', () => {
    const p = toSvgPoint({ ...FRAME, distance: 100, bearing: 180 })
    expect(p.x).toBeCloseTo(C, 6)
    expect(p.y).toBeCloseTo(C + 112 / 1.2, 6)
  })

  it('0m는 bearing과 무관하게 중심이다', () => {
    for (const bearing of [0, 90, 180, 270]) {
      const p = toSvgPoint({ ...FRAME, distance: 0, bearing })
      expect(p.x).toBeCloseTo(C, 6)
      expect(p.y).toBeCloseTo(C, 6)
    }
  })
})
