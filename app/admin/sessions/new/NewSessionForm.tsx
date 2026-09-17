'use client'

// 임시 세션 생성 폼 (T29, ARCHITECTURE.md §24).
//
// 장소를 고르면 반경 슬라이더가 그 장소의 default_radius로 초기화되고, 이후 운영자가 조정한다.
// 시각은 datetime-local 값('YYYY-MM-DDTHH:mm', KST 벽시계)을 그대로 보낸다 — KST 해석은 서버가
// lib/kst.ts로 한다. 마감 여부도 여기서 미리 보지 않는다. 서버 판정 문구가 버튼 위에 뜬다.
// open_after_min·session_type은 폼에 없다. 서버가 10·'regular'로 박는다 (§5·§17).
//
// 저장은 actions/create-session.ts를 부른다. 성공하면 요약 카드 하나와 메인 링크를 보여 주고
// 폼은 초기화한다. 버튼이 비활성일 때 이유는 버튼 바로 위 한 줄에 항상 뜬다 (CLAUDE.md UI 규칙).

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { createSession } from '@/actions/create-session'
import { formatKstHHmm, formatKstWeekday, kstDateString } from '@/lib/kst'
import { PLACE_RADIUS_MAX, PLACE_RADIUS_MIN } from '@/lib/placeResult'
import { OPEN_BEFORE_DEFAULT, OPEN_BEFORE_MAX, OPEN_BEFORE_MIN } from '@/lib/sessionResult'

export interface PlaceOption {
  id: string
  name: string
  defaultRadius: number
}

export interface NewSessionFormProps {
  places: PlaceOption[] // 비어 있지 않다. 0개면 page.tsx가 폼 대신 안내를 그린다.
}

// UI 전용 문구. 액션 결과 문구는 lib/sessionResult.ts SESSION_MESSAGES다.
const SAVING = '저장 중입니다'
const NEED_MEET_AT = '집합 시각을 입력해 주세요'
const BAD_OPEN_BEFORE = `창 시작은 ${OPEN_BEFORE_MIN}~${OPEN_BEFORE_MAX}분 사이 정수여야 합니다`

type Created = { placeName: string; radius: number; meetAt: string }

// 'YYYY-MM-DD' → 'M/D'. kst.ts에 함수를 더하지 않고 문자열로 만든다.
function formatKstMD(d: Date): string {
  const [, m, day] = kstDateString(d).split('-')
  return `${Number(m)}/${Number(day)}`
}

export default function NewSessionForm({ places }: NewSessionFormProps) {
  const first = places[0]
  const [placeId, setPlaceId] = useState(first.id)
  const [radius, setRadius] = useState(first.defaultRadius)
  const [meetAtLocal, setMeetAtLocal] = useState('')
  const [openBefore, setOpenBefore] = useState(String(OPEN_BEFORE_DEFAULT))
  const [message, setMessage] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [isPending, startTransition] = useTransition()

  const selected = places.find((p) => p.id === placeId) ?? first
  const openBeforeMin = Number(openBefore)
  const openBeforeOk =
    openBefore.trim() !== '' &&
    Number.isInteger(openBeforeMin) &&
    openBeforeMin >= OPEN_BEFORE_MIN &&
    openBeforeMin <= OPEN_BEFORE_MAX

  // 저장 버튼이 안 눌리는 이유. 켜져 있으면 빈 줄이되 높이는 유지한다.
  const reason = isPending ? SAVING : !meetAtLocal ? NEED_MEET_AT : !openBeforeOk ? BAD_OPEN_BEFORE : ''
  const canSave = reason === ''

  const choosePlace = (id: string) => {
    setPlaceId(id)
    const p = places.find((x) => x.id === id)
    if (p) setRadius(p.defaultRadius)
  }

  const save = () => {
    if (!canSave) return
    const input = { placeId, meetAtLocal, radius, openBeforeMin }
    const summary = { placeName: selected.name, radius }
    startTransition(async () => {
      const result = await createSession(input)
      if (result.ok) {
        setCreated({ ...summary, meetAt: result.meetAt })
        setPlaceId(first.id)
        setRadius(first.defaultRadius)
        setMeetAtLocal('')
        setOpenBefore(String(OPEN_BEFORE_DEFAULT))
        setMessage(null)
      } else {
        setMessage(result.message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">장소</span>
          <select
            value={placeId}
            onChange={(e) => choosePlace(e.target.value)}
            className="min-h-12 rounded-xl border border-neutral-300 bg-white px-3 text-lg dark:border-neutral-600 dark:bg-neutral-900"
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">집합 시각</span>
          <input
            type="datetime-local"
            step={60}
            value={meetAtLocal}
            onChange={(e) => setMeetAtLocal(e.target.value)}
            className="min-h-12 rounded-xl border border-neutral-300 bg-white px-3 text-lg dark:border-neutral-600 dark:bg-neutral-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">
            반경 <span className="tabular-nums">{radius}m</span>
          </span>
          {/* 장갑 낀 손 기준 탭 영역 48px */}
          <input
            type="range"
            min={PLACE_RADIUS_MIN}
            max={PLACE_RADIUS_MAX}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="h-12 w-full"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">창 시작 (집합 몇 분 전부터 출석 가능)</span>
          <input
            type="number"
            inputMode="numeric"
            min={OPEN_BEFORE_MIN}
            max={OPEN_BEFORE_MAX}
            step={1}
            value={openBefore}
            onChange={(e) => setOpenBefore(e.target.value)}
            className="min-h-12 rounded-xl border border-neutral-300 bg-white px-3 text-lg tabular-nums dark:border-neutral-600 dark:bg-neutral-900"
          />
        </label>

        {/* 저장 버튼 — 비활성 이유 또는 실패 문구는 바로 위 한 줄 */}
        <div className="min-h-5 text-sm">
          <p className="min-h-5 font-semibold">{reason || message || ''}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="min-h-14 w-full rounded-xl text-lg font-bold text-white enabled:bg-green-600 disabled:bg-neutral-400 dark:disabled:bg-neutral-600"
        >
          세션 만들기
        </button>
      </section>

      {created && <CreatedCard created={created} />}
    </div>
  )
}

function CreatedCard({ created }: { created: Created }) {
  const meetAt = new Date(created.meetAt)
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
      <p className="text-sm font-semibold text-green-600 dark:text-green-400">세션을 만들었습니다</p>
      <p className="text-lg font-bold">
        {created.placeName} · {formatKstMD(meetAt)}({formatKstWeekday(meetAt)}) {formatKstHHmm(meetAt)} ·
        반경 {created.radius}m
      </p>
      <Link
        href="/"
        className="flex min-h-12 items-center justify-center rounded-xl bg-neutral-700 px-4 text-base font-bold text-white dark:bg-neutral-600"
      >
        메인으로
      </Link>
    </section>
  )
}
