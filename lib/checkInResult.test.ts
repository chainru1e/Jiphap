import { describe, expect, it } from 'vitest'

import { CHECK_IN_MESSAGES, mapInsertError } from './checkInResult'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

describe('mapInsertError', () => {
  it('23505(unique_violation)는 already다', () => {
    expect(mapInsertError('23505')).toBe('already')
  })

  it.each(['42501', '23503', '23502', 'PGRST301', ''])('%s 는 db_error다', (code) => {
    expect(mapInsertError(code)).toBe('db_error')
  })

  it('코드가 없으면 db_error다 — 모르면 실패로 본다', () => {
    expect(mapInsertError(undefined)).toBe('db_error')
  })

  it('23505는 문자열 완전 일치만 인정한다', () => {
    expect(mapInsertError('23505x')).toBe('db_error')
    expect(mapInsertError(' 23505')).toBe('db_error')
  })
})

describe('CHECK_IN_MESSAGES', () => {
  it('모든 문구가 비어 있지 않다 — 비활성 이유가 항상 떠야 한다', () => {
    for (const [key, message] of Object.entries(CHECK_IN_MESSAGES)) {
      expect(message.length, key).toBeGreaterThan(0)
    }
  })

  it('영어 문구를 남기지 않는다', () => {
    for (const message of Object.values(CHECK_IN_MESSAGES)) {
      expect(message).not.toMatch(/[A-Za-z]/)
    }
  })
})
