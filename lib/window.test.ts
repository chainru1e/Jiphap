import { describe, expect, it } from 'vitest'

import { getWindow, getWindowState } from './window'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

// 토요일 아침 정기런 06:30 KST를 UTC 표기로 적은 것이다.
const MEET_AT = new Date('2026-09-11T21:30:00Z')

// 같은 순간을 KST 오프셋으로 적은 것. 표기만 다르고 epoch ms는 동일해야 한다.
const MEET_AT_KST = new Date('2026-09-12T06:30:00+09:00')

const MINUTE = 60000

describe('getWindow', () => {
  it('opensAt이 meetAt에서 openBeforeMin분 앞이다', () => {
    const { opensAt } = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    expect(opensAt.getTime()).toBe(MEET_AT.getTime() - 10 * MINUTE)
  })

  it('closesAt이 meetAt에서 openAfterMin분 뒤다', () => {
    const { closesAt } = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    expect(closesAt.getTime()).toBe(MEET_AT.getTime() + 10 * MINUTE)
  })

  // sessions.open_before_min / open_after_min의 기본값이 둘 다 10이므로,
  // 실제로 가장 많이 만들어질 창의 폭을 고정해 둔다.
  it('기본값 10/10이면 창이 20분이다', () => {
    const { opensAt, closesAt } = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    expect(closesAt.getTime() - opensAt.getTime()).toBe(20 * MINUTE)
  })

  // 인자로 받은 Date를 그대로 들고 있다가 호출 측이 바꾸면 창이 따라 움직인다.
  // 새 Date를 만들어 돌려주는지 확인한다.
  it('meetAt 객체를 그대로 돌려주지 않는다', () => {
    const { opensAt, closesAt } = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 0,
      openAfterMin: 0,
    })
    expect(opensAt).not.toBe(MEET_AT)
    expect(closesAt).not.toBe(MEET_AT)
  })

  // 모임이 시작된 뒤에 창이 열리는 설계도 가능하므로 음수를 막지 않는다.
  it('openBeforeMin이 음수면 opensAt이 meetAt보다 뒤다', () => {
    const { opensAt } = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: -5,
      openAfterMin: 10,
    })
    expect(opensAt.getTime()).toBe(MEET_AT.getTime() + 5 * MINUTE)
  })

  it('meetAt이 Invalid Date면 RangeError를 던진다', () => {
    expect(() =>
      getWindow({
        meetAt: new Date('아무거나'),
        openBeforeMin: 10,
        openAfterMin: 10,
      }),
    ).toThrow(RangeError)
  })

  it('openBeforeMin이 유한수가 아니면 RangeError를 던진다', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() =>
        getWindow({ meetAt: MEET_AT, openBeforeMin: bad, openAfterMin: 10 }),
      ).toThrow(RangeError)
    }
  })

  it('openAfterMin이 유한수가 아니면 RangeError를 던진다', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() =>
        getWindow({ meetAt: MEET_AT, openBeforeMin: 10, openAfterMin: bad }),
      ).toThrow(RangeError)
    }
  })

  it('openAfterMin이 음수면 RangeError를 던진다', () => {
    expect(() =>
      getWindow({ meetAt: MEET_AT, openBeforeMin: 10, openAfterMin: -1 }),
    ).toThrow(RangeError)
  })

  // T08 완료 기준의 "KST 기준 확인"이 여기다. 둘은 표기만 다른 같은 순간이라
  // 창 경계도 같아야 한다 — 다르게 나온다면 어딘가에서 로컬 시각 부품을 쓴 것이다.
  it('UTC 표기와 KST 오프셋 표기가 같은 창을 낸다', () => {
    const utc = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    const kst = getWindow({
      meetAt: MEET_AT_KST,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    expect(kst.opensAt.getTime()).toBe(utc.opensAt.getTime())
    expect(kst.closesAt.getTime()).toBe(utc.closesAt.getTime())
  })
})

describe('getWindowState', () => {
  const w = getWindow({ meetAt: MEET_AT, openBeforeMin: 10, openAfterMin: 10 })
  const opensMs = w.opensAt.getTime()
  const closesMs = w.closesAt.getTime()

  // 아래 네 케이스가 이 모듈의 전부다. 반열린 구간 [opensAt, closesAt)에서
  // off-by-one이 나면 마감 정각 출첵이 분쟁이 된다.

  it('now가 opensAt 1ms 전이면 before다', () => {
    expect(getWindowState(w, new Date(opensMs - 1))).toBe('before')
  })

  it('now가 opensAt 정각이면 open이다', () => {
    expect(getWindowState(w, new Date(opensMs))).toBe('open')
  })

  it('now가 closesAt 1ms 전이면 open이다', () => {
    expect(getWindowState(w, new Date(closesMs - 1))).toBe('open')
  })

  it('now가 closesAt 정각이면 after다', () => {
    expect(getWindowState(w, new Date(closesMs))).toBe('after')
  })

  it('meetAt 정각은 open이다', () => {
    expect(getWindowState(w, MEET_AT)).toBe('open')
  })

  it('창을 한참 지나면 after다', () => {
    expect(getWindowState(w, new Date(closesMs + 60 * MINUTE))).toBe('after')
  })

  // 0/0이면 opensAt === closesAt이라 반열린 구간이 빈 집합이 된다.
  // 경계가 닫힌 쪽으로 구현되면 이 한 점에서 'open'이 새어 나온다.
  it('창이 한 점으로 붕괴하면 어떤 now에도 open이 아니다', () => {
    const collapsed = getWindow({
      meetAt: MEET_AT,
      openBeforeMin: 0,
      openAfterMin: 0,
    })
    const meetMs = MEET_AT.getTime()
    const probes = [
      meetMs - MINUTE,
      meetMs - 1,
      meetMs,
      meetMs + 1,
      meetMs + MINUTE,
    ]

    for (const ms of probes) {
      expect(getWindowState(collapsed, new Date(ms))).not.toBe('open')
    }
  })

  // 표기만 다른 같은 순간이므로 판정도 같아야 한다.
  it('UTC 표기와 KST 오프셋 표기가 같은 판정을 낸다', () => {
    const kstWindow = getWindow({
      meetAt: MEET_AT_KST,
      openBeforeMin: 10,
      openAfterMin: 10,
    })
    const probes = [opensMs - 1, opensMs, closesMs - 1, closesMs]

    for (const ms of probes) {
      expect(getWindowState(kstWindow, new Date(ms))).toBe(
        getWindowState(w, new Date(ms)),
      )
    }
  })

  // NaN 비교가 전부 false라 가드가 없으면 조용히 'after'가 나온다.
  // 판정 실패를 마감으로 둔갑시키지 않는다.
  it('now가 Invalid Date면 RangeError를 던진다', () => {
    expect(() => getWindowState(w, new Date('아무거나'))).toThrow(RangeError)
  })

  it('창 경계가 Invalid Date면 RangeError를 던진다', () => {
    const broken = { opensAt: new Date(NaN), closesAt: w.closesAt }
    expect(() => getWindowState(broken, MEET_AT)).toThrow(RangeError)
  })
})
