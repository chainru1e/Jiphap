import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { nowSnapshotMs, subscribeEvery } from './useNow'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.
//
// 훅 자체는 여기서 돌리지 않는다. jsdom·testing-library가 없고, 이 훅의 동작은
// 스냅샷(초 단위 내림)과 구독(setInterval) 두 조각이 전부라 그 둘을 직접 검증한다.

describe('nowSnapshotMs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('같은 초 안에서는 같은 값이다 (리렌더가 없어야 한다)', () => {
    const base = new Date('2026-01-01T06:50:00.000+09:00').getTime()
    vi.setSystemTime(base)
    const first = nowSnapshotMs()
    vi.setSystemTime(base + 999)
    expect(nowSnapshotMs()).toBe(first)
  })

  it('초가 바뀌면 값이 바뀐다', () => {
    const base = new Date('2026-01-01T06:50:00.000+09:00').getTime()
    vi.setSystemTime(base)
    const first = nowSnapshotMs()
    vi.setSystemTime(base + 1000)
    expect(nowSnapshotMs()).toBe(first + 1000)
  })

  it('밀리초를 버린 값이다', () => {
    const base = new Date('2026-01-01T06:50:00.000+09:00').getTime()
    vi.setSystemTime(base + 345)
    expect(nowSnapshotMs()).toBe(base)
  })
})

describe('subscribeEvery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('intervalMs마다 콜백을 부르고, 해제하면 더 부르지 않는다', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeEvery(1000)(onChange)

    vi.advanceTimersByTime(999)
    expect(onChange).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(onChange).toHaveBeenCalledTimes(3)

    unsubscribe()
    vi.advanceTimersByTime(5000)
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})
