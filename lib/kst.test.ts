import { describe, expect, it } from 'vitest'

import { formatKstHHmm, formatKstWeekday, kstDateString, kstDateTime } from './kst'

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

// 2026-09-12는 토요일이다 (lib/window.test.ts의 "토요일 아침 정기런"과 같은 날).
describe('formatKstWeekday', () => {
  it('UTC 토요일 15:00은 KST 일요일 00:00이다 (요일 경계)', () => {
    expect(formatKstWeekday(new Date('2026-09-12T15:00:00Z'))).toBe('일요일')
  })

  it('UTC 토요일 14:59는 아직 KST 토요일이다', () => {
    expect(formatKstWeekday(new Date('2026-09-12T14:59:59Z'))).toBe('토요일')
  })

  it('UTC 월요일 21:00은 KST 화요일 06:00이다', () => {
    expect(formatKstWeekday(new Date('2026-09-14T21:00:00Z'))).toBe('화요일')
  })

  it('Invalid Date면 RangeError', () => {
    expect(() => formatKstWeekday(new Date('x'))).toThrow(RangeError)
  })
})

describe('kstDateString', () => {
  it('UTC 15:00은 KST 다음날이다 (자정 넘김)', () => {
    expect(kstDateString(new Date('2026-09-12T15:00:00Z'))).toBe('2026-09-13')
  })

  it('UTC 14:59는 아직 KST 같은 날이다', () => {
    expect(kstDateString(new Date('2026-09-12T14:59:59Z'))).toBe('2026-09-12')
  })

  it('한 자리 월·일은 0으로 채운다', () => {
    expect(kstDateString(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05')
  })

  it('연말 UTC 15:00은 KST 새해 첫날이다', () => {
    expect(kstDateString(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01')
  })

  it('Invalid Date면 RangeError', () => {
    expect(() => kstDateString(new Date('x'))).toThrow(RangeError)
  })
})

describe('kstDateTime', () => {
  it('KST 벽시계 시각을 그 순간의 Date로 만든다', () => {
    expect(kstDateTime('2026-09-15', '06:50').getTime()).toBe(
      new Date('2026-09-14T21:50:00Z').getTime(),
    )
  })

  it('HH:MM:SS도 받되 초는 버린다', () => {
    expect(kstDateTime('2026-09-15', '06:50:45').getTime()).toBe(
      new Date('2026-09-14T21:50:00Z').getTime(),
    )
  })

  it('KST 자정은 전날 UTC 15:00이다', () => {
    expect(kstDateTime('2026-09-13', '00:00').getTime()).toBe(
      new Date('2026-09-12T15:00:00Z').getTime(),
    )
  })

  it('kstDateString과 왕복한다', () => {
    for (const date of ['2026-01-01', '2026-09-15', '2026-12-31', '2028-02-29']) {
      expect(kstDateString(kstDateTime(date, '00:00'))).toBe(date)
      expect(kstDateString(kstDateTime(date, '23:59'))).toBe(date)
    }
  })

  it('formatKstHHmm과 왕복한다', () => {
    expect(formatKstHHmm(kstDateTime('2026-09-15', '06:50'))).toBe('06:50')
  })

  it('형식이 틀리면 RangeError', () => {
    expect(() => kstDateTime('2026-9-15', '06:50')).toThrow(RangeError)
    expect(() => kstDateTime('2026/09/15', '06:50')).toThrow(RangeError)
    expect(() => kstDateTime('2026-09-15', '6:50')).toThrow(RangeError)
    expect(() => kstDateTime('2026-09-15', '06:50:00.000')).toThrow(RangeError)
    expect(() => kstDateTime('', '')).toThrow(RangeError)
  })

  it('범위를 벗어난 시·분은 RangeError', () => {
    expect(() => kstDateTime('2026-09-15', '24:00')).toThrow(RangeError)
    expect(() => kstDateTime('2026-09-15', '06:60')).toThrow(RangeError)
  })

  it('존재하지 않는 날짜는 RangeError (Date.UTC의 롤오버를 허용하지 않는다)', () => {
    expect(() => kstDateTime('2026-02-30', '06:50')).toThrow(RangeError)
    expect(() => kstDateTime('2026-13-01', '06:50')).toThrow(RangeError)
    expect(() => kstDateTime('2026-09-00', '06:50')).toThrow(RangeError)
  })
})
