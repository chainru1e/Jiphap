'use client'

// useGeolocation 결과를 글자로만 보여 주는 개발용 표시부. 훅을 쓰므로 클라이언트다.
// 스타일과 포맷을 넣지 않는다 — 훅이 주는 값을 가공 없이 눈으로 확인하는 자리다.

import { useGeolocation } from '@/hooks/useGeolocation'

export default function DevGeo() {
  const { status, position, message } = useGeolocation()

  return (
    <main className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">useGeolocation</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt>status</dt>
        <dd>{status}</dd>
        <dt>lat</dt>
        <dd>{position ? position.lat : '-'}</dd>
        <dt>lng</dt>
        <dd>{position ? position.lng : '-'}</dd>
        <dt>accuracy</dt>
        <dd>{position ? position.accuracy : '-'}</dd>
        <dt>message</dt>
        <dd>{message ?? '-'}</dd>
      </dl>
    </main>
  )
}
