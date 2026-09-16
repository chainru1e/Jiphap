// Geolocation 에러 → 한국어 안내. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// 이 모듈은 문구만 만든다. 위치를 얻는 일은 hooks/useGeolocation.ts가 하고, 여기서는
// 그 훅이 넘겨준 에러 코드를 종류로 가르고 종류를 문구로 바꾼다. 문구를 훅 안에 두지
// 않는 이유는 Node 테스트 환경에서 네 문구가 서로 다른지 확인하기 위해서다.
//
// 권한 거부·신호 없음·타임아웃·미지원은 사용자가 할 일이 각각 다르다. 하나의 문구로
// 뭉개면 "왜 안 되지"에 답하지 못한다 (CLAUDE.md 코드 규칙: 에러를 삼키지 않는다).

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

/**
 * GeolocationPositionError.code를 종류로 바꾼다.
 * 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT. 숫자를 직접 쓰는 이유는
 * GeolocationPositionError 전역이 브라우저에만 있어 순수 함수에서 참조할 수 없기 때문이다.
 * 그 외 값은 unavailable로 본다 — 원인을 모르면 "잠시 후 다시" 가 가장 무해한 안내다.
 */
export function geoErrorKind(code: number): GeoErrorKind {
  switch (code) {
    case 1:
      return 'denied'
    case 2:
      return 'unavailable'
    case 3:
      return 'timeout'
    default:
      return 'unavailable'
  }
}

const MESSAGES: Record<GeoErrorKind, string> = {
  // 사용자가 할 일: 브라우저 설정에서 권한을 켠다. 앱은 다시 물어볼 수 없다.
  denied:
    '위치 권한이 꺼져 있습니다. 브라우저 설정 → 사이트 권한 → 위치를 허용해 주세요.',
  // 사용자가 할 일: 밖으로 나가거나 기다린다.
  unavailable:
    '위치를 잡지 못했습니다. 실내이거나 GPS 신호가 약합니다. 잠시 후 다시 시도해 주세요.',
  // 사용자가 할 일: 하늘이 보이는 곳으로 옮긴다. watch는 계속 돌고 있으므로 재시도 버튼이 필요 없다.
  timeout: '위치 확인이 늦어지고 있습니다. 하늘이 보이는 곳으로 이동해 주세요.',
  // 사용자가 할 일: 다른 브라우저를 쓴다. 이 앱에서는 해결할 수 없다.
  unsupported: '이 브라우저는 위치 기능을 지원하지 않습니다.',
}

/** 종류별 안내 문구. 어떤 종류에도 빈 문자열이 아니고, 네 문구는 서로 다르다. */
export function geoErrorMessage(kind: GeoErrorKind): string {
  return MESSAGES[kind]
}
