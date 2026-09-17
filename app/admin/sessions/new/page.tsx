import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'

import NewSessionForm, { type PlaceOption } from './NewSessionForm'

// 임시 세션 생성 (T29, ARCHITECTURE.md §24). Server Component가 활성 장소 목록을 읽어 Client
// Component에 props로 넘긴다 — app/admin/places/page.tsx와 같은 패턴.
//
// lib/supabase/server.ts로 읽는다 — RLS places_read가 active 회원에게 SELECT를 허용하므로 충분하다.
// admin 클라이언트는 여기서 쓰지 않는다 (§3). 좌표는 select하지 않는다 — 스냅샷은 액션이 서버에서
// 복사한다 (§7). 세션 목록·취소는 T31이라 여기 없다.
//
// 요청 쿠키를 타므로 자동으로 dynamic이다. export const dynamic은 쓰지 않는다 (§15).

const LOAD_ERROR_MESSAGE = '장소 목록을 불러오지 못했습니다'
const NO_PLACES_MESSAGE = '먼저 장소를 등록해 주세요'

type PlaceRow = { id: string; name: string; default_radius: number }

export default async function NewSessionPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('places')
    .select('id, name, default_radius')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('[create-session] places query failed', { code: error.code })
  }

  const places: PlaceOption[] = ((data ?? []) as PlaceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    defaultRadius: row.default_radius,
  }))

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6 text-foreground">
      <h1 className="text-2xl font-bold">임시 세션 만들기</h1>

      {error ? (
        <p className="text-base font-semibold">{LOAD_ERROR_MESSAGE}</p>
      ) : places.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{NO_PLACES_MESSAGE}</p>
          <Link
            href="/admin/places"
            className="flex min-h-12 items-center justify-center rounded-xl bg-neutral-700 px-4 text-base font-bold text-white dark:bg-neutral-600"
          >
            장소 관리로
          </Link>
        </div>
      ) : (
        <NewSessionForm places={places} />
      )}
    </main>
  )
}
