// GPS 정확도 경고. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// 이 모듈은 문구만 만든다. 판정은 lib/gate.ts가 하고, getGate는 accuracy를 입력으로
// 받지도 않는다. 정확도를 이유로 출첵을 막지 않는다 — 실제로 도착한 사람을 막는 것이
// 오차보다 큰 문제다 (ARCHITECTURE.md §5). 두 모듈을 합치고 싶어져도 합치지 않는다.
// 합치는 순간 "경고만"이 "판정에 반영"으로 새기 쉽다.

/**
 * accuracy > radius 이면 §5 문구를, 아니면 null을 돌려준다.
 * 경계(accuracy === radius)는 경고하지 않는다. 오차가 반경과 같으면 반경 안이라는
 * 판정을 의심할 이유가 아직 없기 때문이다.
 */
export function accuracyWarning({
  accuracy,
  radius,
}: {
  accuracy: number
  radius: number
}): string | null {
  if (accuracy > radius) {
    // 소수점 m는 아침 7시 밖에서 읽을 정보가 아니다. 정수로만 보여 준다.
    return `GPS 오차(±${Math.round(accuracy)}m)가 반경보다 큽니다. 하늘이 트인 곳에서 잠시 기다려 주세요.`
  }
  return null
}
