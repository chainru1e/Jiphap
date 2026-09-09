// 세션 출석 창 판정. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// DB에 opens_at/closes_at 생성 열이 없는 이유는 0001_schema.sql 주석과 ARCHITECTURE.md §7에
// 있다. timestamptz ± interval이 STABLE이라 IMMUTABLE을 요구하는 생성 열에 못 쓴다.
// 그래서 sessions는 meet_at과 ±분만 갖고, 창 경계를 만드는 책임은 전부 이 모듈에 있다.
//
// 현재 시각은 반드시 인자로 받는다. 모듈 안에서 Date.now()를 부르면 T17 슬라이더가
// 임의 시각을 주입할 수 없고, 경계 테스트 자체가 불가능해진다.
//
// 세션 종류(session_type)는 보지 않는다. 번개러닝은 세션을 만들 때 다른 분값을 넣는
// 것으로 처리되므로, 창 판정에 종류가 끼어들 자리가 없다.

export type WindowState = 'before' | 'open' | 'after'

const MS_PER_MIN = 60000

// 비교는 예외 없이 epoch ms로 한다. getHours·getDate 같은 로컬 시각 부품을 쓰면
// 실행 환경의 TZ에 판정이 끌려간다. KST 표시는 렌더링 계층 책임이다.
function toEpochMs(d: Date, label: string): number {
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError(`${label}이(가) 유효한 시각이 아닙니다.`)
  }
  return ms
}

/**
 * 세션 행의 창 경계 두 시각. 파라미터는 sessions 컬럼과 1:1로 대응한다
 * (meetAt=meet_at, openBeforeMin=open_before_min, openAfterMin=open_after_min).
 */
export function getWindow(input: {
  meetAt: Date
  openBeforeMin: number
  openAfterMin: number
}): { opensAt: Date; closesAt: Date } {
  const meetMs = toEpochMs(input.meetAt, 'meetAt')

  if (!Number.isFinite(input.openBeforeMin)) {
    throw new RangeError('openBeforeMin이 유한한 수가 아닙니다.')
  }
  if (!Number.isFinite(input.openAfterMin)) {
    throw new RangeError('openAfterMin이 유한한 수가 아닙니다.')
  }

  // openAfterMin이 음수면 창이 열리기도 전에 닫힌다. 어떤 now에도 'open'이 나올 수 없어
  // 아무도 출첵할 수 없는 세션이 조용히 만들어지므로 여기서 끊는다.
  if (input.openAfterMin < 0) {
    throw new RangeError('openAfterMin은 음수일 수 없습니다.')
  }

  // openBeforeMin은 음수를 허용한다. 모임이 시작된 뒤에 창이 열리는 설계도 가능하고,
  // 그 경우 opensAt이 meetAt보다 뒤가 될 뿐 판정은 그대로 성립한다.
  return {
    opensAt: new Date(meetMs - input.openBeforeMin * MS_PER_MIN),
    closesAt: new Date(meetMs + input.openAfterMin * MS_PER_MIN),
  }
}

/**
 * 반열린 구간 [opensAt, closesAt)로 판정한다. now === opensAt은 'open',
 * now === closesAt은 'after' — 마감 정각에 누른 부원이 나오면 실제 분쟁이 되므로
 * 어느 쪽인지를 여기서 못 박는다.
 */
export function getWindowState(
  w: { opensAt: Date; closesAt: Date },
  now: Date,
): WindowState {
  const opensMs = toEpochMs(w.opensAt, 'opensAt')
  const closesMs = toEpochMs(w.closesAt, 'closesAt')

  // Invalid Date의 getTime()은 NaN이고 NaN 비교는 전부 false라, 가드가 없으면 아래
  // 분기가 조용히 'after'를 낸다. 판정 실패를 마감으로 둔갑시키지 않는다.
  const nowMs = toEpochMs(now, 'now')

  if (nowMs < opensMs) return 'before'
  if (nowMs < closesMs) return 'open'
  return 'after'
}
