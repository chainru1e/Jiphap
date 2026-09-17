'use client'

// 사용자 메인 화면 (T23, ARCHITECTURE.md §21). 스크롤 없는 한 화면 — 부모가 높이를 주고
// (page.tsx의 h-dvh, /dev의 375×667 프레임) 이 컴포넌트는 h-full로 그 안을 나눈다.
//
// 버튼은 lib/gate.ts 결과로 켜고 끈다 (T24, §22). 렌더만 한다 — onClick 없음, 클릭 연결은 T57,
// 인원 수 조회는 T47. 비활성 이유는 버튼 바로 위 상태 줄에 항상 뜬다 (§5). 상태 줄은
// min-height로 고정해 문구가 떠도 버튼이 안 움직인다.
//
// 여기서 켜진 버튼은 서버가 다시 판정한다 (§3·§4). 시계도 GPS도 클라이언트 값이라 판정이 아니다.
//
// sim은 dev 전용이다. app/(app)/page.tsx는 넘기지 않고, /dev의 DevMainScreen만 시각·거리를 주입한다.
//
// NextSessionResult는 타입으로만 가져온다. lib/queries/nextSession.ts는 server-only라
// 값 import는 빌드에서 막힌다. 타입 import는 컴파일에서 지워져 번들에 들어가지 않는다.
//
// 좌표는 SessionView 안에서 거리·방위 계산과 지도에만 쓴다. 화면·콘솔에 찍지 않는다 (§8).

import DirectionsButton from '@/components/DirectionsButton'
import MapOrRadar from '@/components/MapOrRadar'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNow } from '@/hooks/useNow'
import { accuracyWarning } from '@/lib/accuracy'
import { getGate } from '@/lib/gate'
import { bearingDeg, distanceM, type LatLng } from '@/lib/geo'
import { formatKstHHmm, formatKstWeekday } from '@/lib/kst'
import type { SessionRow } from '@/lib/nextSession'
import type { NextSessionResult } from '@/lib/queries/nextSession'
import { getWindow, getWindowState } from '@/lib/window'

const TYPE_LABEL = { regular: '정규', flash: '번개' } as const

// dev 전용 주입. now는 창 판정 시각, distM은 GPS 대신 쓸 거리(m).
export interface MainScreenSim {
  now?: Date
  distM?: number
}

export interface MainScreenProps {
  result: NextSessionResult
  sim?: MainScreenSim
}

export default function MainScreen({ result, sim }: MainScreenProps) {
  // 세션 분기를 자식으로 나눈다 — useGeolocation은 세션이 있을 때만 마운트되어야 한다.
  // notice/error 화면에서 GPS를 켤 이유가 없고, 훅 규칙상 조건부로 부를 수도 없다.
  if (result.kind === 'session') {
    return <SessionView session={result.session} sim={sim} />
  }
  return <NoticeCard message={result.message} />
}

function NoticeCard({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="w-full max-w-sm rounded-2xl bg-neutral-100 px-6 py-10 text-center text-2xl font-bold dark:bg-neutral-800">
        {message}
      </p>
    </div>
  )
}

function SessionView({ session, sim }: { session: SessionRow; sim?: MainScreenSim }) {
  const { position, message } = useGeolocation()
  // 훅은 조건 없이 부르고, 주입값이 있으면 그걸 쓴다. `sim?.now ?? useNow()`는 훅 규칙 위반이다.
  const clock = useNow()
  const now = sim?.now ?? clock

  const center: LatLng = { lat: session.place_lat, lng: session.place_lng }
  const meetAt = new Date(session.meet_at)

  // DevMap.tsx와 같은 계산. inside는 게이트가 아니라 반경 기준이다 — 창 이전이라도 지도색은 반경으로 정한다.
  const gpsDist = position ? distanceM(position, center) : null
  const dist = sim?.distM ?? gpsDist
  const bearing = sim?.distM !== undefined || !position ? 0 : bearingDeg(position, center)
  const inside = dist !== null && dist <= session.radius
  // 경고는 GPS 값 기준 그대로. 판정에 섞지 않는다 (§5).
  const warning = position ? accuracyWarning({ accuracy: position.accuracy, radius: session.radius }) : null

  // 창은 lib/window.ts, 판정은 lib/gate.ts. 위치가 없으면 판정할 거리가 없어 게이트를 부르지 않는다.
  const w = getWindow({
    meetAt,
    openBeforeMin: session.open_before_min,
    openAfterMin: session.open_after_min,
  })
  const gate =
    dist === null
      ? null
      : getGate({
          windowState: getWindowState(w, now),
          distM: dist,
          radiusM: session.radius,
          opensAt: w.opensAt,
          now,
          opensAtLabel: formatKstHHmm(w.opensAt),
        })

  // 상태 줄 1 — 버튼이 안 눌리는 이유. 켜져 있으면 비워 두되 높이는 유지한다.
  const statusLine =
    gate === null ? (message ?? '위치를 기다리는 중입니다') : gate.enabled ? '' : gate.message

  // 색은 두 축만 (§10). 위치가 아직 없으면 반경 밖과 같은 대기색이다.
  const distColor = inside ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 1줄. 창 정보(open_before/after)는 표시하지 않는다. */}
      <h1 className="truncate px-4 py-3 text-lg font-bold">
        {TYPE_LABEL[session.session_type]} · {session.place_name} · {formatKstWeekday(meetAt)}{' '}
        {formatKstHHmm(meetAt)}
      </h1>

      {/* 지도가 남는 높이를 전부 차지한다. min-h-0이 없으면 flex 자식이 내용 높이로 늘어나 화면을 넘긴다. */}
      <div className="relative min-h-0 flex-1">
        <MapOrRadar
          className="h-full w-full"
          center={center}
          radius={session.radius}
          me={position}
          accuracy={position?.accuracy ?? null}
          inside={inside}
          distance={dist}
          bearing={bearing}
        />

        {/* 거리 숫자 — 지도 위 오버레이 (§9). 지도 아래에 두면 스크롤해야 한다. */}
        <p
          className={`absolute top-3 left-3 z-10 rounded-lg bg-white/90 px-3 py-1 text-4xl font-bold tabular-nums dark:bg-neutral-900/90 ${distColor}`}
        >
          {dist === null ? '--' : `${Math.round(dist)}m`}
        </p>

        {/* 버튼 — 지도 위 오버레이. 비활성 이유는 버튼 바로 위 상태 줄 1에 항상 뜬다 (§5). */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-white/90 p-3 dark:bg-neutral-900/90">
          <div className="min-h-12 text-sm">
            <p className="min-h-5 font-semibold">{statusLine}</p>
            {warning && <p className="text-amber-700 dark:text-amber-400">{warning}</p>}
          </div>
          {/* 라벨은 항상 "집합하기". 이유는 윗줄이 말한다. onClick은 T57. 색은 활성/대기 두 축뿐 (§10). */}
          <button
            type="button"
            disabled={gate === null || !gate.enabled}
            className="min-h-14 w-full rounded-xl text-lg font-bold text-white enabled:bg-green-600 disabled:bg-amber-600"
          >
            집합하기
          </button>
        </div>
      </div>

      {/* 하단 1줄. 인원 수는 T47이 채운다. */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-base font-bold">참석 인원 —</p>
        <DirectionsButton dest={center} />
      </div>
    </div>
  )
}
