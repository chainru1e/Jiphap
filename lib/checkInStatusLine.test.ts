import { describe, expect, it } from 'vitest'

import { SIM_NOTICE, WAITING_POSITION, checkInStatusLine } from './checkInStatusLine'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

const OPEN = { enabled: true, message: '집합하기' }
const TOO_FAR = { enabled: false, message: '82m 더 가까이 가세요' }
const GEO = '위치 권한이 꺼져 있습니다.'
const BASE = { serverMessage: null, simNotice: false, gate: null, geoMessage: null }

describe('checkInStatusLine 우선순위', () => {
  it('서버 문구가 있으면 게이트·GPS보다 우선한다', () => {
    expect(checkInStatusLine({ ...BASE, serverMessage: '출석할 세션이 없습니다.', gate: TOO_FAR, geoMessage: GEO })).toBe(
      '출석할 세션이 없습니다.',
    )
  })

  it('성공 문구도 서버 문구다 — 게이트가 켜져 있어도 빈 줄이 아니다', () => {
    expect(checkInStatusLine({ ...BASE, serverMessage: '출석 완료', gate: OPEN })).toBe('출석 완료')
  })

  it('서버 문구가 있으면 게이트가 마감으로 바뀌어도 그대로다', () => {
    const after = { enabled: false, message: '출첵 마감' }
    expect(checkInStatusLine({ ...BASE, serverMessage: '출석 완료', gate: after })).toBe('출석 완료')
  })

  it('빈 문자열 서버 문구는 없는 것으로 본다', () => {
    expect(checkInStatusLine({ ...BASE, serverMessage: '', gate: TOO_FAR })).toBe(TOO_FAR.message)
  })

  it('sim 안내는 서버 문구 다음, 게이트보다 앞이다', () => {
    expect(checkInStatusLine({ ...BASE, simNotice: true, gate: TOO_FAR })).toBe(SIM_NOTICE)
    expect(checkInStatusLine({ ...BASE, serverMessage: '출석 완료', simNotice: true })).toBe('출석 완료')
  })

  it('게이트가 꺼져 있으면 게이트 사유', () => {
    expect(checkInStatusLine({ ...BASE, gate: TOO_FAR, geoMessage: GEO })).toBe(TOO_FAR.message)
  })

  it('게이트가 켜져 있으면 빈 줄 — GPS 문구가 있어도', () => {
    expect(checkInStatusLine({ ...BASE, gate: OPEN, geoMessage: GEO })).toBe('')
  })

  it('게이트가 없으면(위치 없음) GPS 안내', () => {
    expect(checkInStatusLine({ ...BASE, geoMessage: GEO })).toBe(GEO)
  })

  it('게이트도 GPS 안내도 없으면 대기 문구', () => {
    expect(checkInStatusLine(BASE)).toBe(WAITING_POSITION)
  })

  it('sim 안내는 게이트가 없어도 뜬다', () => {
    expect(checkInStatusLine({ ...BASE, simNotice: true })).toBe(SIM_NOTICE)
  })
})

describe('문구', () => {
  it('비어 있지 않고 영어가 없다', () => {
    for (const m of [WAITING_POSITION, SIM_NOTICE]) {
      expect(m.length).toBeGreaterThan(0)
      expect(m).not.toMatch(/[A-Za-z]/)
    }
  })
})
