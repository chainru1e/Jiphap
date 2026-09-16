import { describe, expect, it } from 'vitest'

import {
  nextOccurrence,
  nextSessionNotice,
  pickNextSession,
  type ScheduleRow,
  type SessionRow,
} from './nextSession'

// vitest globals를 켜지 않고 명시적으로 import한다 — 설정 파일 없이 동작시키기 위해서다.

// 2026-09-15는 화요일이다 (2026-09-12 토요일 기준, lib/window.test.ts와 같은 주).
const kst = (hhmm: string, date = '2026-09-15') => new Date(`${date}T${hhmm}:00+09:00`)

function session(over: Partial<SessionRow> & { meet_at: string }): SessionRow {
  return {
    id: over.meet_at,
    session_type: 'regular',
    place_name: '용봉탑',
    place_lat: 35.1756,
    place_lng: 126.9066,
    radius: 60,
    open_before_min: 10,
    open_after_min: 10,
    ...over,
  }
}

const iso = (hhmm: string, date?: string) => kst(hhmm, date).toISOString()

describe('pickNextSession', () => {
  it('창 열린 flash(06:40)와 창 열린 regular(06:50)가 겹치면 regular다', () => {
    const flash = session({ id: 'flash', session_type: 'flash', meet_at: iso('06:40') })
    const regular = session({ id: 'regular', meet_at: iso('06:50') })
    // 06:45: flash 창 [06:30, 06:50), regular 창 [06:40, 07:00) 둘 다 열려 있다.
    expect(pickNextSession([flash, regular], kst('06:45'))?.id).toBe('regular')
    expect(pickNextSession([regular, flash], kst('06:45'))?.id).toBe('regular')
  })

  it('열린 세션이 둘 다 같은 유형이면 meet_at 이른 쪽이다', () => {
    const a = session({ id: 'a', meet_at: iso('06:50') })
    const b = session({ id: 'b', meet_at: iso('06:40') })
    expect(pickNextSession([a, b], kst('06:45'))?.id).toBe('b')
  })

  it('열린 세션이 없으면 before 중 meet_at 이른 쪽이다', () => {
    const later = session({ id: 'later', meet_at: iso('06:50') })
    const sooner = session({ id: 'sooner', meet_at: iso('06:40') })
    expect(pickNextSession([later, sooner], kst('06:00'))?.id).toBe('sooner')
  })

  it('before끼리 meet_at이 같으면 regular 우선이다', () => {
    const flash = session({ id: 'flash', session_type: 'flash', meet_at: iso('06:50') })
    const regular = session({ id: 'regular', meet_at: iso('06:50') })
    expect(pickNextSession([flash, regular], kst('06:00'))?.id).toBe('regular')
  })

  it('열린 flash만 있고 before regular가 더 이르지 않으면 flash다 (열린 것이 before보다 우선)', () => {
    const flash = session({ id: 'flash', session_type: 'flash', meet_at: iso('06:40') })
    const regular = session({ id: 'regular', meet_at: iso('07:30') })
    expect(pickNextSession([regular, flash], kst('06:45'))?.id).toBe('flash')
  })

  it('창 마감 정각(now === closesAt)은 제외한다 (반열린 구간)', () => {
    const flash = session({ id: 'flash', session_type: 'flash', meet_at: iso('06:40') })
    expect(pickNextSession([flash], kst('06:50'))).toBeNull()
    // 1ms 전까지는 열려 있다.
    expect(pickNextSession([flash], new Date(kst('06:50').getTime() - 1))?.id).toBe('flash')
  })

  it('전부 after면 null이다', () => {
    const rows = [session({ meet_at: iso('06:40') }), session({ meet_at: iso('06:50') })]
    expect(pickNextSession(rows, kst('09:00'))).toBeNull()
  })

  it('빈 배열이면 null이다', () => {
    expect(pickNextSession([], kst('06:45'))).toBeNull()
  })

  it('getWindow가 던지는 행(open_after_min 음수)이 섞여도 나머지로 판정한다', () => {
    const broken = session({ id: 'broken', meet_at: iso('06:40'), open_after_min: -1 })
    const ok = session({ id: 'ok', meet_at: iso('06:50') })
    expect(pickNextSession([broken, ok], kst('06:45'))?.id).toBe('ok')
    expect(pickNextSession([broken], kst('06:45'))).toBeNull()
  })

  it('meet_at이 깨진 행도 건너뛴다', () => {
    const broken = session({ id: 'broken', meet_at: '아무거나' })
    const ok = session({ id: 'ok', meet_at: iso('06:50') })
    expect(pickNextSession([broken, ok], kst('06:45'))?.id).toBe('ok')
  })
})

describe('nextOccurrence', () => {
  // 매주 화요일 06:50. PostgREST가 time을 주는 형식 그대로 초를 붙인다.
  const tue: ScheduleRow = {
    weekdays: [2],
    meet_time: '06:50:00',
    active_from: '2026-09-01',
    active_until: null,
  }

  it('오늘 요일이지만 시각이 지났으면 다음 주 같은 요일이다', () => {
    expect(nextOccurrence([tue], kst('07:00'))?.getTime()).toBe(
      kst('06:50', '2026-09-22').getTime(),
    )
  })

  it('오늘 요일이고 시각 전이면 오늘이다', () => {
    expect(nextOccurrence([tue], kst('06:00'))?.getTime()).toBe(kst('06:50').getTime())
  })

  it('정각은 "다음"이 아니다 (엄격히 뒤)', () => {
    expect(nextOccurrence([tue], kst('06:50'))?.getTime()).toBe(
      kst('06:50', '2026-09-22').getTime(),
    )
  })

  it('active_from이 미래면 그날 이후 첫 발생이다', () => {
    const future = { ...tue, active_from: '2026-09-20' }
    expect(nextOccurrence([future], kst('06:00'))?.getTime()).toBe(
      kst('06:50', '2026-09-22').getTime(),
    )
  })

  it('active_from 당일이 요일과 맞으면 그날이다', () => {
    const future = { ...tue, active_from: '2026-09-22' }
    expect(nextOccurrence([future], kst('06:00'))?.getTime()).toBe(
      kst('06:50', '2026-09-22').getTime(),
    )
  })

  it('active_until이 지난 일정은 무시한다', () => {
    const ended = { ...tue, active_until: '2026-09-10' }
    expect(nextOccurrence([ended], kst('06:00'))).toBeNull()
  })

  it('active_until 당일은 포함한다', () => {
    const lastDay = { ...tue, active_until: '2026-09-15' }
    expect(nextOccurrence([lastDay], kst('06:00'))?.getTime()).toBe(kst('06:50').getTime())
    expect(nextOccurrence([lastDay], kst('07:00'))).toBeNull()
  })

  it('KST 날짜 경계: UTC 월요일 21:00은 KST 화요일 06:00이라 그날 06:50이 잡힌다', () => {
    const now = new Date('2026-09-14T21:00:00Z')
    expect(nextOccurrence([tue], now)?.getTime()).toBe(new Date('2026-09-14T21:50:00Z').getTime())
  })

  it('KST 날짜 경계: UTC 화요일 15:00은 이미 KST 수요일이라 다음 주 화요일이다', () => {
    const now = new Date('2026-09-15T15:00:00Z')
    expect(nextOccurrence([tue], now)?.getTime()).toBe(kst('06:50', '2026-09-22').getTime())
  })

  it('여러 일정 중 가장 이른 후보를 고른다', () => {
    const thu: ScheduleRow = { ...tue, weekdays: [4], meet_time: '06:30:00' }
    // 화요일 07:00: 화 06:50은 지났고, 목 06:30이 다음 주 화보다 이르다.
    expect(nextOccurrence([tue, thu], kst('07:00'))?.getTime()).toBe(
      kst('06:30', '2026-09-17').getTime(),
    )
  })

  it('0~6 밖의 요일 값은 무시한다', () => {
    const junk = { ...tue, weekdays: [7, -1, 1.5, 2] }
    expect(nextOccurrence([junk], kst('06:00'))?.getTime()).toBe(kst('06:50').getTime())
    expect(nextOccurrence([{ ...tue, weekdays: [7] }], kst('06:00'))).toBeNull()
  })

  it('일정이 없으면 null이다', () => {
    expect(nextOccurrence([], kst('06:00'))).toBeNull()
  })
})

describe('nextSessionNotice', () => {
  it('발생 시각이 있으면 "다음 집합: 요일 HH:mm"이다', () => {
    expect(nextSessionNotice(kst('06:50'))).toBe('다음 집합: 화요일 06:50')
  })

  it('없으면 "예정된 집합이 없습니다"다', () => {
    expect(nextSessionNotice(null)).toBe('예정된 집합이 없습니다')
  })
})
