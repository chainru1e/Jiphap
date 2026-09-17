import { describe, expect, it } from 'vitest'

import {
  PLACE_MESSAGES,
  PLACE_NAME_MAX,
  PLACE_RADIUS_DEFAULT,
  PLACE_RADIUS_MAX,
  PLACE_RADIUS_MIN,
  isCreatePlaceInput,
  isSetPlaceActiveInput,
} from './placeResult'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

const VALID = { name: '용봉탑', lat: 35.1756, lng: 126.9066, radius: 60 }

describe('isCreatePlaceInput', () => {
  it('정상 입력을 통과시킨다', () => {
    expect(isCreatePlaceInput(VALID)).toBe(true)
  })

  it('기본 반경은 허용 범위 안이다', () => {
    expect(PLACE_RADIUS_DEFAULT).toBeGreaterThanOrEqual(PLACE_RADIUS_MIN)
    expect(PLACE_RADIUS_DEFAULT).toBeLessThanOrEqual(PLACE_RADIUS_MAX)
  })

  it.each([
    [19, false],
    [20, true],
    [200, true],
    [201, false],
  ])('radius %i → %s (경계 20~200)', (radius, ok) => {
    expect(isCreatePlaceInput({ ...VALID, radius })).toBe(ok)
  })

  it('radius는 정수여야 한다', () => {
    expect(isCreatePlaceInput({ ...VALID, radius: 60.5 })).toBe(false)
  })

  it('name이 공백만이면 거부한다', () => {
    expect(isCreatePlaceInput({ ...VALID, name: '   ' })).toBe(false)
    expect(isCreatePlaceInput({ ...VALID, name: '' })).toBe(false)
  })

  it('name은 trim 후 1자면 된다', () => {
    expect(isCreatePlaceInput({ ...VALID, name: '  탑  ' })).toBe(true)
  })

  it(`name ${PLACE_NAME_MAX}자는 되고 ${PLACE_NAME_MAX + 1}자는 안 된다`, () => {
    expect(isCreatePlaceInput({ ...VALID, name: '가'.repeat(PLACE_NAME_MAX) })).toBe(true)
    expect(isCreatePlaceInput({ ...VALID, name: '가'.repeat(PLACE_NAME_MAX + 1) })).toBe(false)
  })

  it('name 길이는 trim 후로 센다 — 공백을 붙여 41자가 되어도 통과한다', () => {
    expect(isCreatePlaceInput({ ...VALID, name: '가'.repeat(PLACE_NAME_MAX) + ' ' })).toBe(true)
  })

  it.each([
    [90, true],
    [90.1, false],
    [-90, true],
    [-90.1, false],
  ])('lat %s → %s', (lat, ok) => {
    expect(isCreatePlaceInput({ ...VALID, lat })).toBe(ok)
  })

  it.each([
    [180, true],
    [180.1, false],
    [-180.1, false],
  ])('lng %s → %s', (lng, ok) => {
    expect(isCreatePlaceInput({ ...VALID, lng })).toBe(ok)
  })

  it('NaN·Infinity 좌표를 거부한다', () => {
    expect(isCreatePlaceInput({ ...VALID, lat: NaN })).toBe(false)
    expect(isCreatePlaceInput({ ...VALID, lng: Infinity })).toBe(false)
  })

  it('숫자 문자열은 숫자가 아니다', () => {
    expect(isCreatePlaceInput({ ...VALID, lat: '35.1' })).toBe(false)
    expect(isCreatePlaceInput({ ...VALID, radius: '60' })).toBe(false)
  })

  it('객체가 아니거나 필드가 빠지면 거부한다', () => {
    expect(isCreatePlaceInput(null)).toBe(false)
    expect(isCreatePlaceInput('용봉탑')).toBe(false)
    expect(isCreatePlaceInput({})).toBe(false)
    const { radius: _radius, ...noRadius } = VALID
    void _radius
    expect(isCreatePlaceInput(noRadius)).toBe(false)
  })
})

describe('isSetPlaceActiveInput', () => {
  const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

  it('uuid + boolean을 통과시킨다', () => {
    expect(isSetPlaceActiveInput({ id: ID, isActive: false })).toBe(true)
  })

  it('대문자 uuid도 허용한다', () => {
    expect(isSetPlaceActiveInput({ id: ID.toUpperCase(), isActive: true })).toBe(true)
  })

  it('uuid 형태가 아니면 거부한다', () => {
    expect(isSetPlaceActiveInput({ id: 'dev', isActive: true })).toBe(false)
    expect(isSetPlaceActiveInput({ id: ID + 'a', isActive: true })).toBe(false)
    expect(isSetPlaceActiveInput({ id: '', isActive: true })).toBe(false)
  })

  it('isActive가 boolean이 아니면 거부한다', () => {
    expect(isSetPlaceActiveInput({ id: ID, isActive: 'true' })).toBe(false)
    expect(isSetPlaceActiveInput({ id: ID, isActive: 1 })).toBe(false)
    expect(isSetPlaceActiveInput({ id: ID })).toBe(false)
  })

  it('객체가 아니면 거부한다', () => {
    expect(isSetPlaceActiveInput(null)).toBe(false)
    expect(isSetPlaceActiveInput(ID)).toBe(false)
  })
})

describe('PLACE_MESSAGES', () => {
  it('모든 문구가 비어 있지 않다 — 실패 이유가 항상 떠야 한다', () => {
    for (const [key, message] of Object.entries(PLACE_MESSAGES)) {
      expect(message.length, key).toBeGreaterThan(0)
    }
  })

  it('영어 문구를 남기지 않는다', () => {
    for (const message of Object.values(PLACE_MESSAGES)) {
      expect(message).not.toMatch(/[A-Za-z]/)
    }
  })
})
