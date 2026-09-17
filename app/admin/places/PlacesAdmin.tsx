'use client'

// 장소 등록 폼 + 목록 (T27, ARCHITECTURE.md §23).
//
// 좌표는 "지금 내 위치를 집합 장소로 지정"을 누르는 순간 useGeolocation이 들고 있는 최신
// position을 그대로 담는다 (P1). 샘플 평균·재시도 없음. 위도·경도 input은 없고 (§11), 좌표 숫자는
// 화면에 찍지 않는다 — "위치 지정됨"만 보인다. 지도 핀은 T58.
//
// `정확도 ±Nm`은 항상 표시한다. V01(반경 측정)이 이 숫자를 몇 분간 관찰하는 데 쓴다.
// accuracyWarning은 경고만 하고 저장을 막지 않는다 — 실제로 현장에 선 운영자를 막는 게 오차보다
// 큰 문제다 (§5와 같은 원칙).
//
// 저장·토글은 actions/places.ts를 부른다. 액션이 revalidatePath를 하므로 성공하면 부모(page.tsx)의
// props가 같은 응답으로 갱신된다. 여기서 목록을 낙관적으로 고치지 않는다.
// 버튼이 비활성일 때 이유는 버튼 바로 위 한 줄에 항상 뜬다 (CLAUDE.md UI 규칙).

import { useState, useTransition } from 'react'

import { createPlace, setPlaceActive } from '@/actions/places'
import { useGeolocation, type GeoPosition } from '@/hooks/useGeolocation'
import { accuracyWarning } from '@/lib/accuracy'
import {
  PLACE_NAME_MAX,
  PLACE_RADIUS_DEFAULT,
  PLACE_RADIUS_MAX,
  PLACE_RADIUS_MIN,
} from '@/lib/placeResult'

export interface PlaceListItem {
  id: string
  name: string
  radius: number
  createdDate: string // KST 'YYYY-MM-DD'
  isActive: boolean
}

export interface PlacesAdminProps {
  places: PlaceListItem[]
  loadError: string | null
}

// UI 전용 문구. 액션 결과 문구는 lib/placeResult.ts PLACE_MESSAGES다.
const WAITING_POSITION = '위치를 기다리는 중입니다'
const NEED_POSITION = '위치를 먼저 지정해 주세요'
const NEED_NAME = '장소 이름을 입력해 주세요'
const SAVING = '저장 중입니다'
const EMPTY_LIST = '등록된 장소가 없습니다'

// 색은 두 축만 (§10). 활성=green, 대기·비활성=amber.
const ACTIVE_TEXT = 'text-green-600 dark:text-green-400'
const WAITING_TEXT = 'text-amber-600 dark:text-amber-400'

export default function PlacesAdmin({ places, loadError }: PlacesAdminProps) {
  return (
    <div className="flex flex-col gap-8">
      <PlaceForm />
      <PlaceList places={places} loadError={loadError} />
    </div>
  )
}

function PlaceForm() {
  const { position, message: geoMessage } = useGeolocation()
  const [name, setName] = useState('')
  const [radius, setRadius] = useState(PLACE_RADIUS_DEFAULT)
  const [pinned, setPinned] = useState<GeoPosition | null>(null)
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const trimmedName = name.trim()
  // 경고는 지정 시점의 정확도 × 지금 슬라이더 반경. 슬라이더를 옮기면 다시 계산된다.
  const warning = pinned ? accuracyWarning({ accuracy: pinned.accuracy, radius }) : null

  // 저장 버튼이 안 눌리는 이유. 켜져 있으면 빈 줄이되 높이는 유지한다.
  const saveReason = isPending ? SAVING : !pinned ? NEED_POSITION : !trimmedName ? NEED_NAME : ''
  const canSave = saveReason === ''

  const pin = () => {
    if (!position) return
    setPinned(position)
    setFormMessage(null)
  }

  const save = () => {
    if (!pinned || !canSave) return
    const input = { name: trimmedName, lat: pinned.lat, lng: pinned.lng, radius }
    startTransition(async () => {
      const result = await createPlace(input)
      if (result.ok) {
        setName('')
        setRadius(PLACE_RADIUS_DEFAULT)
        setPinned(null)
        setFormMessage(null)
      } else {
        setFormMessage(result.message)
      }
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800">
      <h2 className="text-lg font-bold">새 장소</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">이름</span>
        <input
          type="text"
          value={name}
          maxLength={PLACE_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 용봉탑"
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

      {/* GPS 상태 줄 — 지정 버튼이 안 눌리는 이유 + 상시 정확도 (V01 관찰용) */}
      <div className="min-h-12 text-sm">
        <p className="min-h-5 font-semibold">{geoMessage ?? (position ? '' : WAITING_POSITION)}</p>
        {position && (
          <p className="text-base font-bold tabular-nums">정확도 ±{Math.round(position.accuracy)}m</p>
        )}
      </div>
      <button
        type="button"
        onClick={pin}
        disabled={!position}
        className="min-h-14 w-full rounded-xl text-lg font-bold text-white enabled:bg-green-600 disabled:bg-amber-600"
      >
        지금 내 위치를 집합 장소로 지정
      </button>
      <div className="min-h-10 text-sm">
        <p className={`min-h-5 font-semibold ${pinned ? ACTIVE_TEXT : WAITING_TEXT}`}>
          {pinned ? '위치 지정됨' : '위치가 아직 지정되지 않았습니다'}
        </p>
        {warning && <p className="text-amber-700 dark:text-amber-400">{warning}</p>}
      </div>

      {/* 저장 버튼 — 비활성 이유는 바로 위 한 줄 */}
      <div className="min-h-5 text-sm">
        <p className="min-h-5 font-semibold">{saveReason || formMessage || ''}</p>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="min-h-14 w-full rounded-xl text-lg font-bold text-white enabled:bg-green-600 disabled:bg-neutral-400 dark:disabled:bg-neutral-600"
      >
        저장
      </button>
    </section>
  )
}

function PlaceList({ places, loadError }: PlacesAdminProps) {
  const [listMessage, setListMessage] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (place: PlaceListItem) => {
    setPendingId(place.id)
    setListMessage(null)
    startTransition(async () => {
      const result = await setPlaceActive({ id: place.id, isActive: !place.isActive })
      if (!result.ok) setListMessage(result.message)
      setPendingId(null)
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">저장된 장소</h2>
      {listMessage && <p className="text-sm font-semibold">{listMessage}</p>}

      {loadError ? (
        <p className="text-base font-semibold">{loadError}</p>
      ) : places.length === 0 ? (
        <p className="text-base font-semibold">{EMPTY_LIST}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {places.map((place) => (
            <li
              key={place.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-800"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{place.name}</p>
                <p className="text-sm tabular-nums">
                  반경 {place.radius}m · {place.createdDate}
                </p>
                <p className={`text-sm font-semibold ${place.isActive ? ACTIVE_TEXT : WAITING_TEXT}`}>
                  {place.isActive ? '활성' : '비활성'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(place)}
                disabled={pendingId === place.id}
                className="min-h-12 shrink-0 rounded-xl px-4 text-base font-bold text-white enabled:bg-neutral-700 disabled:bg-neutral-400 dark:enabled:bg-neutral-600 dark:disabled:bg-neutral-700"
              >
                {place.isActive ? '비활성으로' : '활성으로'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
