import { describe, expect, it } from 'vitest'

import { accuracyWarning } from './accuracy'
import { getGate } from './gate'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

describe('accuracyWarning', () => {
  it('accuracy > radius 이면 반올림한 m 값이 든 문구를 돌려준다', () => {
    expect(accuracyWarning({ accuracy: 137.4, radius: 100 })).toBe(
      'GPS 오차(±137m)가 반경보다 큽니다. 하늘이 트인 곳에서 잠시 기다려 주세요.',
    )
    expect(accuracyWarning({ accuracy: 137.5, radius: 100 })).toBe(
      'GPS 오차(±138m)가 반경보다 큽니다. 하늘이 트인 곳에서 잠시 기다려 주세요.',
    )
  })

  it('accuracy === radius 이면 null', () => {
    expect(accuracyWarning({ accuracy: 100, radius: 100 })).toBeNull()
  })

  it('accuracy < radius 이면 null', () => {
    expect(accuracyWarning({ accuracy: 5, radius: 100 })).toBeNull()
  })
})

// T10 완료 기준: 오차가 커도 enabled가 그대로다.
// getGate는 accuracy를 입력으로 받지 않는다. 그래도 이 테스트를 두는 이유는, 누군가
// 나중에 accuracy를 게이트에 넣으려 할 때 여기서 먼저 깨지게 하기 위해서다.
describe('정확도는 게이트 판정을 바꾸지 않는다', () => {
  const OPENS_AT = new Date('2026-09-11T21:20:00Z')
  const RADIUS = 100

  // 화면이 하는 일을 그대로 흉내 낸다: 판정과 경고를 각각 구해서 나란히 놓는다.
  function decide(distM: number, accuracy: number) {
    const gate = getGate({
      windowState: 'open',
      distM,
      radiusM: RADIUS,
      opensAt: OPENS_AT,
      now: new Date(OPENS_AT.getTime() + 60000),
      opensAtLabel: '06:20',
    })
    return { gate, warning: accuracyWarning({ accuracy, radius: RADIUS }) }
  }

  it('창 안·반경 안: 오차 5m와 500m의 gate 결과가 같고 enabled는 true다', () => {
    const fine = decide(30, 5)
    const coarse = decide(30, 500)
    expect(coarse.gate).toEqual(fine.gate)
    expect(fine.gate.enabled).toBe(true)
    // 경고는 달라야 한다. 같다면 이 테스트가 아무것도 비교하지 않은 것이다.
    expect(fine.warning).toBeNull()
    expect(coarse.warning).not.toBeNull()
  })

  it('창 안·반경 밖: 오차 5m와 500m의 gate 결과가 같고 enabled는 false다', () => {
    const fine = decide(182, 5)
    const coarse = decide(182, 500)
    expect(coarse.gate).toEqual(fine.gate)
    expect(fine.gate).toEqual({
      enabled: false,
      reason: 'too_far',
      message: '82m 더 가까이 가세요',
    })
    expect(fine.warning).toBeNull()
    expect(coarse.warning).not.toBeNull()
  })
})
