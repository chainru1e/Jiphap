import { describe, expect, it } from 'vitest'

// 러너가 실제로 도는지만 확인하는 스모크 테스트.
// Phase 1(T07~T10)에서 lib/geo.ts · window.ts · gate.ts 테스트가 이 자리에 들어온다.
// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.
describe('테스트 러너', () => {
  it('실행된다', () => {
    expect(true).toBe(true)
  })

  it('TypeScript를 트랜스파일한다', () => {
    const double = (n: number): number => n * 2
    expect(double(21)).toBe(42)
  })
})
