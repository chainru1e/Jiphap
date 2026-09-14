// 출첵 게이트 판정. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// 서버(check-in Server Action)와 클라이언트(버튼 상태)가 같은 함수를 쓴다. 클라이언트의
// 판정은 버튼을 켜고 끄기 위한 것일 뿐이고, 서버가 같은 규칙으로 반드시 다시 판정한다
// (ARCHITECTURE.md §3, §5).
//
// 이 모듈이 알지 못하는 것들:
// - 현재 시각. now는 인자로 받는다. Date.now()를 부르면 슬라이더로 임의 시각을 주입할 수
//   없고, 서버는 DB now()를 넘겨야 하기 때문이다.
// - 창의 위치. windowState는 lib/window.ts 결과를 그대로 받는다. "창 종료 = meet_at + 10분"은
//   §5의 정책이지 게이트의 지식이 아니다. 여기서 재계산하면 판정 기준이 두 곳으로 갈라진다.
// - 시계 표기. '06:40' 같은 문자열은 호출자가 KST로 포맷해 넘긴다. Intl·toLocaleString을
//   쓰면 실행 환경의 TZ에 문구가 끌려간다.
// - GPS 정확도. 정확도는 경고만 띄우고 판정을 바꾸지 않는다(§5). accuracy가 여기 들어오면
//   "정확도를 이유로 출첵을 막지 않는다"는 절대 규칙이 깨진다.
// - 회원 자격. profiles.status는 라우트 가드와 서버 액션의 몫이다.
//
// "지각" 상태는 없다. 창 안이면 출석, 창 밖이면 거부뿐이다(§5). 사유는 4개이고 칸은 6개인데,
// before_window와 after_window는 위치축에 따라 같은 사유에 다른 문구가 붙기 때문이다.

import type { WindowState } from './window'

export type GateReason = 'ok' | 'before_window' | 'too_far' | 'after_window'

export type GateResult = {
  // reason === 'ok'와 동치. UI가 직접 읽으므로 중복이어도 남긴다.
  enabled: boolean
  reason: GateReason
  // 어떤 경우에도 빈 문자열이 아니다. 비활성 이유가 버튼 바로 위에 항상 떠야 한다(§5).
  message: string
}

const MS_PER_MIN = 60000

function toEpochMs(d: Date, label: string): number {
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError(`${label}이(가) 유효한 시각이 아닙니다.`)
  }
  return ms
}

export function getGate(input: {
  windowState: WindowState
  distM: number
  radiusM: number
  opensAt: Date
  now: Date
  opensAtLabel: string
}): GateResult {
  const { windowState, distM, radiusM, opensAtLabel } = input

  if (!Number.isFinite(distM)) {
    throw new RangeError('distM이 유한한 수가 아닙니다.')
  }
  if (!Number.isFinite(radiusM)) {
    throw new RangeError('radiusM이 유한한 수가 아닙니다.')
  }
  if (distM < 0) {
    throw new RangeError('distM은 음수일 수 없습니다.')
  }
  // 반경 0은 아무도 들어올 수 없는 세션이다. 조용히 too_far만 내지 않도록 여기서 끊는다.
  if (radiusM <= 0) {
    throw new RangeError('radiusM은 0보다 커야 합니다.')
  }
  const opensMs = toEpochMs(input.opensAt, 'opensAt')
  const nowMs = toEpochMs(input.now, 'now')
  // message에 그대로 들어가므로 비어 있으면 "부터 · 12분 남음" 같은 문구가 나간다.
  if (opensAtLabel === '') {
    throw new RangeError('opensAtLabel이 비어 있습니다.')
  }

  // 경계 포함. GPS 오차가 있는 상황에서 실제로 도착한 사람을 막는 것이 더 큰 문제이므로
  // 경계에서는 관대한 쪽을 택한다.
  const inRadius = distM <= radiusM

  switch (windowState) {
    case 'before': {
      if (inRadius) {
        return {
          enabled: false,
          reason: 'before_window',
          message: `도착 확인 · ${opensAtLabel}에 열립니다`,
        }
      }
      // ceil: 0분 30초 남았을 때 "0분 남음"이 뜨면 부원이 버튼을 누르며 서 있게 된다.
      const minLeft = Math.ceil((opensMs - nowMs) / MS_PER_MIN)
      return {
        enabled: false,
        reason: 'before_window',
        message: `${opensAtLabel}부터 · ${minLeft}분 남음`,
      }
    }
    case 'open': {
      if (inRadius) {
        return { enabled: true, reason: 'ok', message: '집합하기' }
      }
      // ceil: 0.4m 부족한데 "0m 더 가까이"가 뜨면 같은 문제가 생긴다.
      const shortM = Math.ceil(distM - radiusM)
      return {
        enabled: false,
        reason: 'too_far',
        message: `${shortM}m 더 가까이 가세요`,
      }
    }
    case 'after': {
      return {
        enabled: false,
        reason: 'after_window',
        message: inRadius ? '마감 · 운영자에게 문의' : '출첵 마감',
      }
    }
  }
}
