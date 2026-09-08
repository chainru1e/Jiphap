import { describe, expect, it } from 'vitest'

import { bearingDeg, distanceM, type LatLng } from './geo'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

const SEOUL_CITY_HALL: LatLng = { lat: 37.5663, lng: 126.9779 }
const GWANGJU_CITY_HALL: LatLng = { lat: 35.1601, lng: 126.8514 }
const EQUATOR_ORIGIN: LatLng = { lat: 0, lng: 0 }

describe('distanceM', () => {
  // 허용오차를 두는 이유: 기대값은 하버사인 산출값을 pin 한 것이지 측정값이 아니다.
  // 지도 서비스가 쓰는 타원체 측지선 값과는 이 거리에서 수백 m까지 차이가 날 수 있다.
  it('서울시청 ↔ 광주시청이 약 267.8km다', () => {
    const d = distanceM(SEOUL_CITY_HALL, GWANGJU_CITY_HALL)
    expect(d).toBeGreaterThan(267796.8 - 1000)
    expect(d).toBeLessThan(267796.8 + 1000)
  })

  it('동일 지점은 0이다', () => {
    expect(distanceM(SEOUL_CITY_HALL, SEOUL_CITY_HALL)).toBe(0)
  })

  it('대칭이다', () => {
    expect(distanceM(SEOUL_CITY_HALL, GWANGJU_CITY_HALL)).toBe(
      distanceM(GWANGJU_CITY_HALL, SEOUL_CITY_HALL),
    )
  })

  // 체크인 반경 스케일(수십~수백 m)에서도 값이 합리적인지 본다.
  // 위도 1도 ≈ 111km이므로 0.0009도면 약 100m다.
  it('체크인 반경 스케일의 짧은 거리를 낸다', () => {
    const hundredMetresNorth: LatLng = {
      lat: GWANGJU_CITY_HALL.lat + 0.0009,
      lng: GWANGJU_CITY_HALL.lng,
    }
    expect(distanceM(GWANGJU_CITY_HALL, hundredMetresNorth)).toBeCloseTo(100, 0)
  })
})

describe('bearingDeg', () => {
  it('적도 원점에서 정북은 0이다', () => {
    expect(bearingDeg(EQUATOR_ORIGIN, { lat: 1, lng: 0 })).toBe(0)
  })

  it('적도 원점에서 정동은 90이다', () => {
    expect(bearingDeg(EQUATOR_ORIGIN, { lat: 0, lng: 1 })).toBe(90)
  })

  it('적도 원점에서 정남은 180이다', () => {
    expect(bearingDeg(EQUATOR_ORIGIN, { lat: -1, lng: 0 })).toBe(180)
  })

  it('적도 원점에서 정서는 270이다', () => {
    expect(bearingDeg(EQUATOR_ORIGIN, { lat: 0, lng: -1 })).toBe(270)
  })

  it('서울시청 → 광주시청은 약 182.46도다', () => {
    const deg = bearingDeg(SEOUL_CITY_HALL, GWANGJU_CITY_HALL)
    expect(deg).toBeGreaterThan(182.46 - 0.1)
    expect(deg).toBeLessThan(182.46 + 0.1)
  })

  it('광주시청 → 서울시청은 약 2.39도다', () => {
    const deg = bearingDeg(GWANGJU_CITY_HALL, SEOUL_CITY_HALL)
    expect(deg).toBeGreaterThan(2.39 - 0.1)
    expect(deg).toBeLessThan(2.39 + 0.1)
  })

  // 이 0은 북쪽이 아니라 "방위가 정의되지 않음"이다. 그 판단은 호출 측 책임이고,
  // 여기서는 상쇄가 부동소수 오차 없이 정확히 일어난다는 것만 고정해 둔다.
  it('동일 지점은 0이다', () => {
    expect(bearingDeg(SEOUL_CITY_HALL, SEOUL_CITY_HALL)).toBe(0)
  })

  it('항상 0 이상 360 미만을 반환한다', () => {
    // 남반구·고위도·날짜변경선 양쪽을 섞어 정규화가 어디서도 범위를 벗어나지 않는지 본다.
    const points: LatLng[] = [
      SEOUL_CITY_HALL,
      GWANGJU_CITY_HALL,
      EQUATOR_ORIGIN,
      { lat: -33.8688, lng: 151.2093 },
      { lat: 64.1466, lng: -21.9426 },
      { lat: 0, lng: 179.9 },
      { lat: 0, lng: -179.9 },
    ]

    for (const from of points) {
      for (const to of points) {
        const deg = bearingDeg(from, to)
        expect(deg).toBeGreaterThanOrEqual(0)
        expect(deg).toBeLessThan(360)
      }
    }
  })
})
