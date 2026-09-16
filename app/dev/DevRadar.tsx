'use client'

// Radar에 대표 상태 5세트를 넣어 나란히 보여 주는 개발용 표시부.
// T16 완료 기준 "props를 바꿔가며 모든 상태가 그려진다"를 여기서 눈으로 확인한다.

import Radar, { type RadarProps } from '@/components/Radar'

const CASES: { label: string; props: RadarProps }[] = [
  { label: '안쪽', props: { distance: 50, bearing: 45, accuracy: 15, radius: 100 } },
  { label: '경계', props: { distance: 100, bearing: 180, accuracy: 10, radius: 100 } },
  { label: '밖', props: { distance: 300, bearing: 270, accuracy: 20, radius: 100 } },
  { label: '오차큼', props: { distance: 60, bearing: 0, accuracy: 150, radius: 100 } },
  { label: '0m', props: { distance: 0, bearing: 0, accuracy: 5, radius: 100 } },
]

export default function DevRadar() {
  return (
    <section className="p-4 font-mono text-sm">
      <h1 className="mb-4 text-base font-bold">Radar</h1>
      <div className="flex flex-wrap gap-6">
        {CASES.map(({ label, props }) => (
          <figure key={label}>
            <Radar {...props} />
            <figcaption className="mt-1">
              {label} · d={props.distance} b={props.bearing} a={props.accuracy} r={props.radius}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
