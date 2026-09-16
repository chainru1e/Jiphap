import { notFound } from 'next/navigation'

import DevGeo from './DevGeo'

// 개발 전용 페이지. 프로덕션 빌드에서는 404다 — T16·T17의 "/dev 페이지에서 확인"이
// 여기에 쌓이고, 시뮬레이션 슬라이더는 프로덕션에서 숨겨야 한다 (TASKS.md T17).
//
// Server Component로 둔다. notFound()는 Server Component · Server Function · Route
// Handler에서만 지원한다 (node_modules/next/dist/docs/.../not-found.md). 훅을 쓰는
// 표시부는 DevGeo.tsx로 분리했다.
export default function DevPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <DevGeo />
}
