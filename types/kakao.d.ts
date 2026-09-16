// 카카오맵 JS SDK 전역 최소 선언 (T18).
//
// 패키지(kakao.maps.d.ts 등)를 설치하지 않고 직접 적는 이유: 이 앱이 쓰는 API 면적이
// 마커·원·오버레이 정도로 작고, 설치는 티켓 범위 밖이다. 여기 없는 API를 쓰게 되면
// 그때 그 멤버만 추가한다. 쓰지 않는 필드는 적지 않는다 — 있는 척하면 컴파일은 되고
// 런타임에서 깨진다.
//
// SDK는 autoload=false로 로드하므로, kakao.maps.load 콜백 안에서만 나머지를 쓸 수 있다.

declare namespace kakao.maps {
  function load(callback: () => void): void

  class LatLng {
    constructor(lat: number, lng: number)
  }

  class LatLngBounds {
    constructor(sw?: LatLng, ne?: LatLng)
    extend(latlng: LatLng): void
  }

  interface MapOptions {
    center: LatLng
    level?: number
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions)
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number,
    ): void
    relayout(): void
  }

  interface MarkerOptions {
    position: LatLng
    map?: Map
  }

  class Marker {
    constructor(options: MarkerOptions)
    setPosition(position: LatLng): void
    setMap(map: Map | null): void
  }

  interface CircleOptions {
    center: LatLng
    radius: number
    strokeWeight?: number
    strokeColor?: string
    strokeOpacity?: number
    fillColor?: string
    fillOpacity?: number
    map?: Map
  }

  class Circle {
    constructor(options: CircleOptions)
    setPosition(position: LatLng): void
    setRadius(radius: number): void
    setOptions(options: Partial<CircleOptions>): void
    getBounds(): LatLngBounds
    setMap(map: Map | null): void
  }

  interface CustomOverlayOptions {
    position: LatLng
    content: HTMLElement | string
    map?: Map
    xAnchor?: number
    yAnchor?: number
    zIndex?: number
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions)
    setPosition(position: LatLng): void
    setMap(map: Map | null): void
  }
}
