'use client'

// 시뮬레이션 거리 슬라이더 (T17). GPS 대신 임의 거리를 주입해 반경 경계에서 버튼이
// 정확히 열리고 닫히는지 확인하는 개발 도구다. 상태 없음 — 값은 부모가 들고 있다.
//
// GPS·gate·Radar를 import하지 않는다. 이 컴포넌트는 숫자 하나를 고르는 일만 하고,
// 그 숫자로 무엇을 할지는 부모(app/dev/DevSim.tsx)의 몫이다.

import type { ChangeEvent } from 'react'

export interface DistanceSliderProps {
  value: number | null // null = 꺼짐(실제 GPS)
  onChange: (v: number | null) => void
  max: number
}

// range input은 null을 표현할 수 없다. 맨 왼쪽(-1)을 "꺼짐"으로 두면 손가락을 끝까지
// 밀어서 실제 GPS로 돌아오는 동작이 자연스럽다 (TASKS.md T17 "맨 왼쪽이 꺼짐").
const OFF = -1

export default function DistanceSlider({ value, onChange, max }: DistanceSliderProps) {
  // 프로덕션에서 시뮬레이션 값이 판정에 들어가면 GPS 없이 출첵 버튼이 켜진다.
  // /dev 페이지가 404인 것과 별개로 컴포넌트 자체도 렌더하지 않는다.
  if (process.env.NODE_ENV === 'production') return null

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value)
    onChange(n < 0 ? null : n)
  }

  return (
    <label className="block font-mono text-sm">
      <span className="block">
        {value === null ? '시뮬레이션 꺼짐 (실제 GPS)' : `${value}m`}
      </span>
      {/* 아침 7시 장갑 낀 손 기준 탭 영역 48px (CLAUDE.md UI 규칙) */}
      <input
        type="range"
        min={OFF}
        max={max}
        step={1}
        value={value ?? OFF}
        onChange={handleChange}
        className="h-12 w-full"
      />
    </label>
  )
}
