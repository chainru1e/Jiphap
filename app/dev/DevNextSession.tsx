// /dev 확인용: getNextSession() 결과를 kind별로 그대로 보여준다 (T22).
// 좌표는 찍지 않는다 — 확인에 필요한 건 유형·장소명·시각뿐이다.
//
// async Server Component. 조회가 server-only라 Client Component에서는 import할 수 없다.

import { formatKstHHmm, formatKstWeekday } from '@/lib/kst'
import { getNextSession } from '@/lib/queries/nextSession'

const TYPE_LABEL = { regular: '정규', flash: '번개' } as const

export default async function DevNextSession() {
  const result = await getNextSession()

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevNextSession</h1>
      <p className="mb-2 text-neutral-500">kind: {result.kind}</p>
      {result.kind === 'session' ? (
        <SessionLine session={result.session} />
      ) : (
        <p className="font-bold">{result.message}</p>
      )}
    </section>
  )
}

function SessionLine({
  session,
}: {
  session: Extract<Awaited<ReturnType<typeof getNextSession>>, { kind: 'session' }>['session']
}) {
  const meetAt = new Date(session.meet_at)
  return (
    <p className="font-bold">
      {TYPE_LABEL[session.session_type]} · {session.place_name} · {formatKstWeekday(meetAt)}{' '}
      {formatKstHHmm(meetAt)}
    </p>
  )
}
