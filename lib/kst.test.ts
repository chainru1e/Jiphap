import { describe, expect, it } from 'vitest'

import { formatKstHHmm } from './kst'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

describe('formatKstHHmm', () => {
  it('UTC 자정은 KST 09:00이다', () => {
    expect(formatKstHHmm(new Date('2026-09-12T00:00:00Z'))).toBe('09:00')
  })

  it('전날 UTC 21:20은 KST 다음날 06:20이다 (날짜 경계를 넘어도 시각만 낸다)', () => {
    // lib/gate.test.ts의 OPENS_AT과 같은 값. 두 테스트의 라벨이 일치해야 한다.
    expect(formatKstHHmm(new Date('2026-09-11T21:20:00Z'))).toBe('06:20')
  })

  it('한 자리 시·분은 0으로 채운다', () => {
    expect(formatKstHHmm(new Date('2026-09-11T15:05:00Z'))).toBe('00:05')
  })

  it('+09:00 오프셋으로 만든 Date는 그 시각 그대로 나온다', () => {
    expect(formatKstHHmm(new Date('2026-01-01T06:40:00+09:00'))).toBe('06:40')
  })

  it('초는 버린다', () => {
    expect(formatKstHHmm(new Date('2026-09-11T21:20:59Z'))).toBe('06:20')
  })

  it('Invalid Date면 RangeError', () => {
    expect(() => formatKstHHmm(new Date('x'))).toThrow(RangeError)
  })
})
