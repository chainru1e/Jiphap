import { describe, expect, it } from 'vitest'

import { routeUrl } from './kakaoLink'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

describe('routeUrl', () => {
  it('MobileWeb route 스킴 문자열을 정확히 만든다', () => {
    expect(routeUrl({ lat: 35.1756, lng: 126.9066 })).toBe(
      'https://m.map.kakao.com/scheme/route?ep=35.1756,126.9066&by=foot',
    )
  })

  it('음수 경도와 긴 소수를 자르거나 반올림하지 않는다', () => {
    const dest = { lat: -33.868819812345, lng: -151.209295123456 }
    const url = routeUrl(dest)
    expect(url).toContain(`ep=${String(dest.lat)},${String(dest.lng)}&`)
    expect(url).toContain('-151.209295123456')
  })

  it('도보(by=foot) 고정이고 출발지(sp)는 넣지 않는다', () => {
    const url = routeUrl({ lat: 35.1756, lng: 126.9066 })
    expect(url).toContain('&by=foot')
    expect(url).not.toContain('sp=')
    // route 스킴은 좌표만 받는다. 이름 파라미터가 끼어들면 안 된다.
    expect(url.split('?')[1].split('&').map((p) => p.split('=')[0])).toEqual(['ep', 'by'])
  })
})
