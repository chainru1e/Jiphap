// 카카오맵 길찾기 URL (T20). 순수 함수만 둔다 — React·브라우저 API를 import하지 않는다.
//
// 근거: https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/ "길찾기" 절.
//
// App 스킴(kakaomap://)이 아니라 MobileWeb 스킴을 쓴다. 앱이 없으면 카카오 서버가
// 스토어·모바일웹으로 보내 주므로, "앱이 안 열리면 n초 뒤 폴백" 같은 JS 타이머를 만들
// 이유가 없다 — 그 타이머는 느린 폰에서 앱이 열리는 중에도 터진다.

import type { LatLng } from './geo'

/** 목적지까지 도보 길찾기 URL. */
export function routeUrl(dest: LatLng): string {
  // sp(출발지)는 넣지 않는다. 앱이 현재 위치를 출발지로 잡는다. 넣으려면 사용자의
  // 원좌표를 URL에 실어야 하는데, 원좌표는 검증에만 쓰고 어디에도 남기지 않는다
  // (CLAUDE.md 프라이버시). URL은 브라우저 히스토리와 카카오 서버 로그에 남는다.
  //
  // by=foot 고정. 러닝 집합 장소는 걸어서 가는 거리이고, 이동수단을 파라미터로
  // 열면 호출 측마다 다른 값을 넣어 화면이 갈라진다.
  //
  // 좌표는 String() 그대로. toFixed로 자르면 수십 cm~수 m씩 핀이 어긋나고,
  // 그 어긋남은 반경 판정과 무관하지만 사용자는 "핀이 틀렸다"로 읽는다.
  return `https://m.map.kakao.com/scheme/route?ep=${String(dest.lat)},${String(dest.lng)}&by=foot`
}
