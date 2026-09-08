// 거리와 방위각. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
// 서버(Server Action)가 출첵을 판정할 때 이 계산을 다시 돌리므로, 테스트가 쉬워야 한다.
//
// 공식 출처: https://www.movable-type.co.uk/scripts/latlong.html

export type LatLng = { lat: number; lng: number }

// IUGG 평균 반지름. 지구를 구로 가정한 값이라 WGS84 타원체 측지선과는
// 수백 km 거리에서 수백 m까지 벌어지지만, 이 앱이 판정하는 체크인 반경은
// 수십~수백 m 스케일이라 그 오차가 판정을 뒤집지 않는다.
const EARTH_RADIUS_M = 6371000

// 도와 라디안을 섞는 것이 이 계산에서 가장 흔한 버그다.
// 삼각함수에 넣는 값은 예외 없이 이 함수를 거친 것만 쓴다.
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 두 좌표 사이의 하버사인 거리(m). */
export function distanceM(a: LatLng, b: LatLng): number {
  // 여기서부터 전부 라디안. lat/lng는 도(degree)로 들어온다.
  const phi1 = toRad(a.lat)
  const phi2 = toRad(b.lat)
  const dPhi = toRad(b.lat - a.lat)
  const dLambda = toRad(b.lng - a.lng)

  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2

  // asin(√h) 대신 atan2(√h, √(1−h))를 쓴다. 부동소수 오차로 h가 1을 아주 조금
  // 넘겨도 atan2는 정의역을 벗어나지 않아, 별도 clamp 없이 안전하다.
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** `from`에서 본 `to`의 방위각(도). 북=0, 시계방향, 0 이상 360 미만. */
export function bearingDeg(from: LatLng, to: LatLng): number {
  // 여기서부터 전부 라디안. lat/lng는 도(degree)로 들어온다.
  const phi1 = toRad(from.lat)
  const phi2 = toRad(to.lat)
  const dLambda = toRad(to.lng - from.lng)

  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)

  const deg = (Math.atan2(y, x) * 180) / Math.PI

  // atan2는 −180~180을 내놓는다. 북=0에서 시계방향으로 도는 0~360이 방위각의
  // 표준 관례이고, T16 레이더도 이 관례로 각도를 읽는다. 이 정규화는 덤으로
  // atan2가 낼 수 있는 -0도 0으로 정리해 준다 ((-0 + 360) % 360 === 0).
  //
  // 같은 지점을 넣으면 y와 x가 정확히 0으로 상쇄되어 0이 나온다. 이 0은 북쪽이
  // 아니라 "방위가 정의되지 않음"이다. 거리 0을 중심점으로 그릴지는 호출 측
  // (T16 레이더)이 거리를 보고 정한다 — 여기서 가드하면 그 판단을 가로챈다.
  return (deg + 360) % 360
}
