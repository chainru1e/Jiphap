'use client'

// /dev 확인용: MainScreen을 하드코딩 세션으로 375×667 프레임 안에 그린다 (T23·T24).
// 완료 기준 "375×667에서 스크롤 없이 전부 보인다"와 "슬라이더로 4상태를 전부 눈으로 확인"을
// 여기서 본다 — 창 라디오(시간축) × 거리 슬라이더(위치축)로 §5 표의 여섯 칸을 만든다.
//
// meet_at은 DevMap.tsx와 같은 방식의 고정 상수다. 세 now도 그 상수에서 getWindow로 계산한다 —
// 실제 시계를 읽지 않으니 렌더가 순수하고, 아무 때나 열어도 같은 화면이 나온다.

import { useState } from 'react'

import DistanceSlider from '@/components/DistanceSlider'
import MainScreen from '@/components/MainScreen'
import type { SessionRow } from '@/lib/nextSession'
import { getWindow, type WindowState } from '@/lib/window'

// 임의 좌표. DevMap.tsx와 같은 값이지만 일부러 따로 선언한다 — dev 표시부끼리 import로
// 엮이면 하나를 지울 때 다른 쪽이 깨진다. 실제 집합 장소가 아니다.
const MEET_LAT = 35.1756
const MEET_LNG = 126.9066
const RADIUS_M = 50
const MEET_AT = '2026-01-01T06:50:00+09:00'
const OPEN_BEFORE_MIN = 10
const OPEN_AFTER_MIN = 10

const SESSION: SessionRow = {
  id: 'dev',
  session_type: 'regular',
  place_name: '용봉탑(dev)',
  place_lat: MEET_LAT,
  place_lng: MEET_LNG,
  radius: RADIUS_M,
  meet_at: MEET_AT,
  open_before_min: OPEN_BEFORE_MIN,
  open_after_min: OPEN_AFTER_MIN,
}

const MINUTE = 60000
const WINDOW = getWindow({
  meetAt: new Date(MEET_AT),
  openBeforeMin: OPEN_BEFORE_MIN,
  openAfterMin: OPEN_AFTER_MIN,
})

// 창 상태별 고정 now. 경계 정각이 아니라 1분 안쪽·바깥쪽으로 둔다 — 경계값 자체는 lib/window.test.ts 몫이다.
const NOW_BY_STATE: Record<WindowState, Date> = {
  before: new Date(WINDOW.opensAt.getTime() - MINUTE),
  open: new Date(MEET_AT),
  after: new Date(WINDOW.closesAt.getTime() + MINUTE),
}

const STATE_LABEL: Record<WindowState, string> = {
  before: '창 이전',
  open: '창 안',
  after: '창 이후',
}

export default function DevMainScreen() {
  const [state, setState] = useState<WindowState>('open')
  const [sim, setSim] = useState<number | null>(null)

  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">DevMainScreen (375×667)</h1>

      <div className="mb-4 flex max-w-[375px] flex-col gap-3">
        <fieldset className="flex gap-2">
          <legend className="mb-1">창 상태</legend>
          {(Object.keys(STATE_LABEL) as WindowState[]).map((s) => (
            // 아침 7시 장갑 낀 손 기준 탭 영역 48px (CLAUDE.md UI 규칙)
            <label
              key={s}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-200 px-3 dark:bg-neutral-800"
            >
              <input
                type="radio"
                name="dev-window-state"
                value={s}
                checked={state === s}
                onChange={() => setState(s)}
              />
              {STATE_LABEL[s]}
            </label>
          ))}
        </fieldset>
        <DistanceSlider value={sim} onChange={setSim} max={RADIUS_M * 2} />
      </div>

      <div className="h-[667px] w-[375px] overflow-auto ring-1 ring-neutral-400">
        <MainScreen
          result={{ kind: 'session', session: SESSION }}
          sim={{ now: NOW_BY_STATE[state], distM: sim ?? undefined }}
        />
      </div>
    </section>
  )
}
