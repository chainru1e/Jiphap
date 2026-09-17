'use client'

// 사용자 메인 화면 (T23, ARCHITECTURE.md §21). 스크롤 없는 한 화면 — 부모가 높이를 주고
// (page.tsx의 h-dvh, /dev의 375×667 프레임) 이 컴포넌트는 h-full로 그 안을 나눈다.
//
// 여기서 하지 않는 것: 게이트 판정·체크인 호출은 T24, 인원 수 조회는 T47. 그 자리만 최종
// 크기로 잡아 둔다 — 버튼 56px, 상태 문구 영역은 min-height로 고정해 문구가 떠도 버튼이 안 움직인다.
//
// NextSessionResult는 타입으로만 가져온다. lib/queries/nextSession.ts는 server-only라
// 값 import는 빌드에서 막힌다. 타입 import는 컴파일에서 지워져 번들에 들어가지 않는다.
//
// 좌표는 SessionView 안에서 거리·방위 계산과 지도에만 쓴다. 화면·콘솔에 찍지 않는다 (§8).

import DirectionsButton from '@/components/DirectionsButton'
import MapOrRadar from '@/components/MapOrRadar'
import { useGeolocation } from '@/hooks/useGeolocation'
import { accuracyWarning } from '@/lib/accuracy'
import { bearingDeg, distanceM, type LatLng } from '@/lib/geo'
import { formatKstHHmm, formatKstWeekday } from '@/lib/kst'
import type { SessionRow } from '@/lib/nextSession'
import type { NextSessionResult } from '@/lib/queries/nextSession'

const TYPE_LABEL = { regular: '정규', flash: '번개' } as const

export interface MainScreenProps {
  result: NextSessionResult
}

export default function MainScreen({ result }: MainScreenProps) {
  // 세션 분기를 자식으로 나눈다 — useGeolocation은 세션이 있을 때만 마운트되어야 한다.
  // notice/error 화면에서 GPS를 켤 이유가 없고, 훅 규칙상 조건부로 부를 수도 없다.
  if (result.kind === 'session') {
    return <SessionView session={result.session} />
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

function SessionView({ session }: { session: SessionRow }) {
  const { position, message } = useGeolocation()

  const center: LatLng = { lat: session.place_lat, lng: session.place_lng }
  const meetAt = new Date(session.meet_at)

  // DevMap.tsx와 같은 계산. 판정은 하지 않는다 — inside는 지도·숫자 색을 고르는 데만 쓴다.
  const dist = position ? distanceM(position, center) : null
  const bearing = position ? bearingDeg(position, center) : 0
  const inside = dist !== null && dist <= session.radius
  const warning = position ? accuracyWarning({ accuracy: position.accuracy, radius: session.radius }) : null

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

        {/* 버튼 자리 — 지도 위 오버레이. 상태 문구는 버튼 바로 위에, 없어도 높이를 유지한다. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-white/90 p-3 dark:bg-neutral-900/90">
          <div className="min-h-12 text-sm">
            {message && <p>{message}</p>}
            {warning && <p className="text-amber-700 dark:text-amber-400">{warning}</p>}
          </div>
          {/* T24가 채운다. onClick도 getGate도 없다. 크기만 최종이다 — 56px, 전체 폭. */}
          <button
            type="button"
            disabled
            className="min-h-14 w-full rounded-xl bg-neutral-400 text-lg font-bold text-white dark:bg-neutral-600"
          >
            준비 중
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
