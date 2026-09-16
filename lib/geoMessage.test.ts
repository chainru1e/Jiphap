import { describe, expect, it } from 'vitest'

import { geoErrorKind, geoErrorMessage, type GeoErrorKind } from './geoMessage'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

describe('geoErrorKind', () => {
  it('GeolocationPositionError 코드 1/2/3을 denied/unavailable/timeout으로 바꾼다', () => {
    expect(geoErrorKind(1)).toBe('denied')
    expect(geoErrorKind(2)).toBe('unavailable')
    expect(geoErrorKind(3)).toBe('timeout')
  })

  it('알 수 없는 코드는 unavailable로 본다', () => {
    expect(geoErrorKind(99)).toBe('unavailable')
    expect(geoErrorKind(0)).toBe('unavailable')
    expect(geoErrorKind(-1)).toBe('unavailable')
  })
})

describe('geoErrorMessage', () => {
  const KINDS: GeoErrorKind[] = ['denied', 'unavailable', 'timeout', 'unsupported']

  it('네 종류 모두 비어 있지 않은 문구를 돌려준다', () => {
    for (const kind of KINDS) {
      expect(geoErrorMessage(kind).length).toBeGreaterThan(0)
    }
  })

  it('네 종류의 문구가 서로 다르다', () => {
    const messages = KINDS.map(geoErrorMessage)
    expect(new Set(messages).size).toBe(KINDS.length)
  })
})
