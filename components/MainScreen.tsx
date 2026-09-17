'use client'

// 사용자 메인 화면 (T23, ARCHITECTURE.md §21). 스크롤 없는 한 화면 — 부모가 높이를 주고
// (page.tsx의 h-dvh, /dev의 375×667 프레임) 이 컴포넌트는 h-full로 그 안을 나눈다.
//
// 버튼은 lib/gate.ts 결과로 켜고 끈다 (T24, §22). 클릭은 actions/check-in.ts를 부른다 (T57, §25) —
// 4상태 판정 코드는 그대로 두고 그 위에 전송 중·완료·서버 결과 state를 얹는다. 인원 수 조회는 T47.
// 비활성 이유는 버튼 바로 위 상태 줄에 항상 뜬다 (§5). 어떤 문구가 이기는지는
// lib/checkInStatusLine.ts가 정한다. 상태 줄은 min-height로 고정해 문구가 떠도 버튼이 안 움직인다.
//
// 여기서 켜진 버튼은 서버가 다시 판정한다 (§3·§4). 시계도 GPS도 클라이언트 값이라 판정이 아니다.
// 완료 상태는 클라이언트 state뿐이다 — 새로고침하면 다시 "집합하기"가 보인다. 복원은 T59.
//
// sim은 dev 전용이다. app/(app)/page.tsx는 넘기지 않고, /dev의 DevMainScreen만 시각·거리를 주입한다.
// sim이 있으면 액션을 부르지 않는다 — 슬라이더 거리는 서버 재계산과 어긋난다 (§25).
//
// NextSessionResult는 타입으로만 가져온다. lib/queries/nextSession.ts는 server-only라
// 값 import는 빌드에서 막힌다. 타입 import는 컴파일에서 지워져 번들에 들어가지 않는다.
//
// 좌표는 SessionView 안에서 거리·방위 계산과 지도에만 쓴다. 화면·콘솔에 찍지 않는다 (§8).

import { useState, useTransition } from 'react'

import { checkIn } from '@/actions/check-in'
import DirectionsButton from '@/components/DirectionsButton'
import MapOrRadar from '@/components/MapOrRadar'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNow } from '@/hooks/useNow'
import { accuracyWarning } from '@/lib/accuracy'
import { checkInStatusLine } from '@/lib/checkInStatusLine'
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

  // T57 — 판정 위에 얹는 state. gate 계산은 건드리지 않는다.
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  // sim 모드에서 탭한 시점의 게이트 문구. 슬라이더·라디오로 문구가 바뀌면 안내가 저절로 사라져
  // /dev의 4상태 확인이 살아 있다. effect로 지우지 않는다.
  const [simTappedAt, setSimTappedAt] = useState<string | null>(null)

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

  const simNotice = sim !== undefined && simTappedAt !== null && simTappedAt === (gate?.message ?? null)

  // 상태 줄 1 — 서버 결과 > sim 안내 > 게이트 사유 > GPS 안내 > 빈 줄 (§25). 높이는 유지한다.
  const statusLine = checkInStatusLine({ serverMessage, simNotice, gate, geoMessage: message })

  const handleClick = () => {
    // 직전 서버 결과는 다음 탭에서 지운다. 거절 문구가 영영 남지 않는다.
    setServerMessage(null)
    if (sim !== undefined) {
      setSimTappedAt(gate?.message ?? null)
      return
    }
    // 클릭 시점의 최신 position. 서버가 거리를 다시 계산하므로 여기 값은 입력일 뿐이다 (§3).
    if (!position || gate === null || !gate.enabled) return
    const input = { sessionId: session.id, lat: position.lat, lng: position.lng, accuracy: position.accuracy }
    startTransition(async () => {
      const result = await checkIn(input)
      // 성공과 already는 같은 완료 상태다 — 부원 입장에서 출석이 되어 있는 건 같다 (§19·§25).
      if (result.ok) setDone(true)
      setServerMessage(result.message)
    })
  }

  const buttonLabel = done ? '집합 완료' : isPending ? '확인 중…' : '집합하기'
  // 완료·전송 중은 활성 축 색을 유지한다. 색은 두 축뿐이다 (§10).
  const buttonColor = done
    ? 'bg-green-600'
    : isPending
      ? 'bg-green-600 opacity-70'
      : 'enabled:bg-green-600 disabled:bg-amber-600'

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
          {/* 이유는 윗줄이 말한다. 전송 중·완료면 disabled — 연타는 여기서 1차, 서버 UNIQUE가 최종 (§25). */}
          <button
            type="button"
            onClick={handleClick}
            disabled={isPending || done || gate === null || !gate.enabled}
            className={`min-h-14 w-full rounded-xl text-lg font-bold text-white ${buttonColor}`}
          >
            {buttonLabel}
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
