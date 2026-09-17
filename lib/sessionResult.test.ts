import { describe, expect, it } from 'vitest'

import { kstDateString, kstDateTime } from './kst'
import {
  OPEN_BEFORE_DEFAULT,
  OPEN_BEFORE_MAX,
  OPEN_BEFORE_MIN,
  SESSION_MESSAGES,
  SESSION_OPEN_AFTER_MIN,
  isCreateSessionInput,
  isWindowStillOpen,
  parseMeetAtLocal,
} from './sessionResult'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.
// 현재 시각은 전부 고정 상수다. Date.now()를 부르면 경계 테스트가 성립하지 않는다.

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const VALID = { placeId: ID, meetAtLocal: '2026-09-20T06:50', radius: 60, openBeforeMin: 10 }

describe('상수', () => {
  it('창 종료는 10분 고정이다 (§5)', () => {
    expect(SESSION_OPEN_AFTER_MIN).toBe(10)
  })

  it('창 시작 기본값은 허용 범위 안이다', () => {
    expect(OPEN_BEFORE_DEFAULT).toBeGreaterThanOrEqual(OPEN_BEFORE_MIN)
    expect(OPEN_BEFORE_DEFAULT).toBeLessThanOrEqual(OPEN_BEFORE_MAX)
  })
})

describe('isCreateSessionInput', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(isCreateSessionInput(VALID)).toBe(true)
  })

  it.each([
    ['2026-09-20T06:50:00', '초 포함'],
    ['2026-09-20', '날짜만'],
    ['2026-09-20 06:50', '구분자 공백'],
    ['2026-9-20T06:50', '한 자리 월'],
    ['', '빈 문자열'],
  ])('meetAtLocal %s (%s) 는 거부한다', (meetAtLocal) => {
    expect(isCreateSessionInput({ ...VALID, meetAtLocal })).toBe(false)
  })

  it.each([
    [19, false],
    [20, true],
    [200, true],
    [201, false],
    [60.5, false],
  ])('radius %s → %s', (radius, ok) => {
    expect(isCreateSessionInput({ ...VALID, radius })).toBe(ok)
  })

  it.each([
    [-1, false],
    [0, true],
    [120, true],
    [121, false],
    [10.5, false],
  ])('openBeforeMin %s → %s', (openBeforeMin, ok) => {
    expect(isCreateSessionInput({ ...VALID, openBeforeMin })).toBe(ok)
  })

  it('placeId가 uuid 형태가 아니면 거부한다', () => {
    expect(isCreateSessionInput({ ...VALID, placeId: 'dev' })).toBe(false)
    expect(isCreateSessionInput({ ...VALID, placeId: '' })).toBe(false)
  })

  it('객체가 아니거나 필드가 빠지면 거부한다', () => {
    expect(isCreateSessionInput(null)).toBe(false)
    expect(isCreateSessionInput('x')).toBe(false)
    expect(isCreateSessionInput({})).toBe(false)
    const { radius: _radius, ...noRadius } = VALID
    void _radius
    expect(isCreateSessionInput(noRadius)).toBe(false)
  })
})

describe('parseMeetAtLocal', () => {
  it('KST 06:50은 UTC 전날 21:50이다', () => {
    expect(parseMeetAtLocal('2026-09-20T06:50')?.getTime()).toBe(
      new Date('2026-09-19T21:50:00Z').getTime(),
    )
  })

  it('kstDateTime과 같은 순간을 낸다', () => {
    expect(parseMeetAtLocal('2026-09-20T06:50')?.getTime()).toBe(
      kstDateTime('2026-09-20', '06:50').getTime(),
    )
  })

  it('KST 자정 직후(00:05)는 KST 기준 같은 날이다 — UTC로는 전날 15:05', () => {
    const d = parseMeetAtLocal('2026-09-20T00:05')
    expect(d).not.toBeNull()
    expect(kstDateString(d!)).toBe('2026-09-20')
    expect(d!.toISOString()).toBe('2026-09-19T15:05:00.000Z')
  })

  it.each([
    ['2026-02-30T06:50', '존재하지 않는 날짜'],
    ['2026-09-20T25:00', '25시'],
    ['2026-09-20T06:60', '60분'],
    ['2026-09-20', '시각 없음'],
    ['2026-09-20T06:50:00', '초 포함'],
  ])('%s (%s) 는 null', (s) => {
    expect(parseMeetAtLocal(s)).toBeNull()
  })
})

describe('isWindowStillOpen', () => {
  // 지금은 KST 2026-09-20 06:50. 마감은 meet_at + 10분 고정.
  const NOW = new Date('2026-09-19T21:50:00Z')
  const kst = (hhmm: string) => kstDateTime('2026-09-20', hhmm)

  it('지금 시각의 세션은 열 수 있다 — "지금 06:50 집합 열자"', () => {
    expect(isWindowStillOpen(kst('06:50'), 10, NOW)).toBe(true)
  })

  it('과거 meet_at이라도 마감 전이면 열 수 있다 (06:41 → 마감 06:51)', () => {
    expect(isWindowStillOpen(kst('06:41'), 10, NOW)).toBe(true)
  })

  it('마감 정각은 닫힌 것이다 (06:40 → 마감 06:50 === now)', () => {
    expect(isWindowStillOpen(kst('06:40'), 10, NOW)).toBe(false)
  })

  it('마감이 지난 시각은 거부한다', () => {
    expect(isWindowStillOpen(kst('06:39'), 10, NOW)).toBe(false)
  })

  it('미래 시각은 열 수 있다', () => {
    expect(isWindowStillOpen(kst('18:00'), 10, NOW)).toBe(true)
    expect(isWindowStillOpen(kstDateTime('2026-09-27', '06:50'), 10, NOW)).toBe(true)
  })

  it('openBeforeMin은 마감에 영향이 없다 — 마감은 항상 meet_at + 10', () => {
    expect(isWindowStillOpen(kst('06:40'), 120, NOW)).toBe(false)
    expect(isWindowStillOpen(kst('06:41'), 0, NOW)).toBe(true)
  })

  it('판정할 수 없으면 닫힌 것으로 본다 (Invalid Date)', () => {
    expect(isWindowStillOpen(new Date(NaN), 10, NOW)).toBe(false)
  })
})

describe('SESSION_MESSAGES', () => {
  it('모든 문구가 비어 있지 않다 — 실패 이유가 항상 떠야 한다', () => {
    for (const [key, message] of Object.entries(SESSION_MESSAGES)) {
      expect(message.length, key).toBeGreaterThan(0)
    }
  })

  it('영어 문구를 남기지 않는다', () => {
    for (const message of Object.values(SESSION_MESSAGES)) {
      expect(message).not.toMatch(/[A-Za-z]/)
    }
  })
})
