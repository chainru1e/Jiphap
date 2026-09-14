import { describe, expect, it } from 'vitest'

import { getGate, type GateResult } from './gate'
import type { WindowState } from './window'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

const MINUTE = 60000

// 토요일 아침 정기런 06:30 KST, 창은 10분 전 06:20에 열린다.
const OPENS_AT = new Date('2026-09-11T21:20:00Z')
const LABEL = '06:20'
const RADIUS = 100

// 시간축 케이스는 windowState를 직접 넣는다. 창 위치는 lib/window.ts 몫이고, 이 테스트는
// now가 opensAt보다 12분 앞이라는 것만 남은분 계산에 쓴다.
function gate(
  windowState: WindowState,
  distM: number,
  overrides: Partial<Parameters<typeof getGate>[0]> = {},
): GateResult {
  return getGate({
    windowState,
    distM,
    radiusM: RADIUS,
    opensAt: OPENS_AT,
    now: new Date(OPENS_AT.getTime() - 12 * MINUTE),
    opensAtLabel: LABEL,
    ...overrides,
  })
}

// ARCHITECTURE.md §5 표와의 동기화가 이 테스트의 목적이다. message는 전문을 assert한다.
describe('getGate — §5 표 6칸', () => {
  it('창 이전 · 반경 밖', () => {
    expect(gate('before', 182)).toEqual({
      enabled: false,
      reason: 'before_window',
      message: '06:20부터 · 12분 남음',
    })
  })

  it('창 이전 · 반경 안', () => {
    expect(gate('before', 30)).toEqual({
      enabled: false,
      reason: 'before_window',
      message: '도착 확인 · 06:20에 열립니다',
    })
  })

  it('창 안 · 반경 밖', () => {
    expect(gate('open', 182)).toEqual({
      enabled: false,
      reason: 'too_far',
      message: '82m 더 가까이 가세요',
    })
  })

  it('창 안 · 반경 안', () => {
    expect(gate('open', 30)).toEqual({
      enabled: true,
      reason: 'ok',
      message: '집합하기',
    })
  })

  it('창 이후 · 반경 밖', () => {
    expect(gate('after', 182)).toEqual({
      enabled: false,
      reason: 'after_window',
      message: '출첵 마감',
    })
  })

  it('창 이후 · 반경 안', () => {
    expect(gate('after', 30)).toEqual({
      enabled: false,
      reason: 'after_window',
      message: '마감 · 운영자에게 문의',
    })
  })
})

describe('getGate — 위치축 경계', () => {
  it('distM === radiusM 이면 반경 안이다', () => {
    const r = gate('open', RADIUS)
    expect(r.enabled).toBe(true)
    expect(r.reason).toBe('ok')
  })

  it('distM이 radiusM보다 0.1m 크면 too_far이고 부족거리는 올림해 1m다', () => {
    expect(gate('open', RADIUS + 0.1)).toEqual({
      enabled: false,
      reason: 'too_far',
      message: '1m 더 가까이 가세요',
    })
  })

  it('반경 밖에서 창 이전이면 too_far가 아니라 before_window다', () => {
    expect(gate('before', 182).reason).toBe('before_window')
  })
})

describe('getGate — 남은 분', () => {
  it('11분 30초 남았으면 올림해 12분이다', () => {
    const r = gate('before', 182, {
      now: new Date(OPENS_AT.getTime() - 11.5 * MINUTE),
    })
    expect(r.message).toBe('06:20부터 · 12분 남음')
  })

  it('30초 남았으면 0분이 아니라 1분이다', () => {
    const r = gate('before', 182, {
      now: new Date(OPENS_AT.getTime() - 30000),
    })
    expect(r.message).toBe('06:20부터 · 1분 남음')
  })
})

describe('getGate — 결과 형태', () => {
  const cases: Array<[WindowState, number]> = [
    ['before', 182],
    ['before', 30],
    ['open', 182],
    ['open', 30],
    ['after', 182],
    ['after', 30],
  ]

  it.each(cases)('%s · %dm — message가 비어 있지 않다', (state, dist) => {
    expect(gate(state, dist).message.length).toBeGreaterThan(0)
  })

  it.each(cases)('%s · %dm — enabled는 reason === ok와 동치다', (state, dist) => {
    const r = gate(state, dist)
    expect(r.enabled).toBe(r.reason === 'ok')
  })

  // 지각 같은 필드가 유입되는 것을 막는다.
  it.each(cases)('%s · %dm — 키가 enabled·reason·message뿐이다', (state, dist) => {
    expect(Object.keys(gate(state, dist)).sort()).toEqual(
      ['enabled', 'message', 'reason'],
    )
  })

  it("windowState가 'before'가 아니면 opensAtLabel이 message에 새지 않는다", () => {
    const label = '99:99'
    for (const state of ['open', 'after'] as const) {
      for (const dist of [182, 30]) {
        expect(gate(state, dist, { opensAtLabel: label }).message).not.toContain(label)
      }
    }
  })
})

describe('getGate — 입력 검증', () => {
  it('distM이 유한수가 아니면 RangeError', () => {
    expect(() => gate('open', NaN)).toThrow(RangeError)
    expect(() => gate('open', Infinity)).toThrow(RangeError)
  })

  it('radiusM이 유한수가 아니면 RangeError', () => {
    expect(() => gate('open', 30, { radiusM: NaN })).toThrow(RangeError)
  })

  it('distM이 음수면 RangeError', () => {
    expect(() => gate('open', -1)).toThrow(RangeError)
  })

  it('radiusM이 0 이하면 RangeError', () => {
    expect(() => gate('open', 30, { radiusM: 0 })).toThrow(RangeError)
    expect(() => gate('open', 30, { radiusM: -5 })).toThrow(RangeError)
  })

  it('opensAt이 Invalid Date면 RangeError', () => {
    expect(() => gate('open', 30, { opensAt: new Date('x') })).toThrow(RangeError)
  })

  it('now가 Invalid Date면 RangeError', () => {
    expect(() => gate('open', 30, { now: new Date('x') })).toThrow(RangeError)
  })

  it('opensAtLabel이 빈 문자열이면 RangeError', () => {
    expect(() => gate('open', 30, { opensAtLabel: '' })).toThrow(RangeError)
  })
})
