// 메인 화면 버튼 위 1번째 줄 문구 결정 (T57, ARCHITECTURE.md §25). 순수 함수만 둔다 —
// React·Supabase·브라우저 API를 import하지 않는다.
//
// "왜 안 눌리지"가 이 앱의 유일한 실패 모드라 (§5) 이 한 줄에 무엇이 뜨는지가 곧 UX다.
// 후보가 넷(서버 결과 · 시뮬레이션 안내 · 게이트 사유 · GPS 안내)이라 우선순위를 한 곳에 못 박고
// 테스트한다. 컴포넌트 안에서 삼항으로 늘어놓으면 순서가 조용히 바뀐다.

import type { GateResult } from './gate'

// 위치가 아직 없을 때. useGeolocation이 에러도 위치도 주지 않은 첫 몇 초.
export const WAITING_POSITION = '위치를 기다리는 중입니다'
// /dev 시뮬레이션에서 버튼을 눌렀을 때. 슬라이더 거리는 서버 재계산과 어긋나므로 전송하지 않는다 (§25).
export const SIM_NOTICE = '시뮬레이션: 전송 안 함'

export function checkInStatusLine(input: {
  // 액션 결과 문구. 거절·성공·already 모두. 다음 탭에서 null로 지운다.
  serverMessage: string | null
  // sim 모드에서 탭한 직후. 게이트 문구가 바뀌면 컴포넌트가 false로 돌린다.
  simNotice: boolean
  gate: Pick<GateResult, 'enabled' | 'message'> | null
  // useGeolocation().message — 권한 거부·타임아웃 등
  geoMessage: string | null
}): string {
  // 서버가 답한 게 있으면 그게 최우선이다. 게이트가 "집합하기"라고 해도 서버가 거절했으면
  // 그 이유를 보여야 하고, 성공했으면 마감이 지나도 "출석 완료"가 남아야 한다.
  if (input.serverMessage) return input.serverMessage
  if (input.simNotice) return SIM_NOTICE
  if (input.gate !== null) return input.gate.enabled ? '' : input.gate.message
  return input.geoMessage ?? WAITING_POSITION
}
