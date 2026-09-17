import { kstDateString } from '@/lib/kst'
import { createClient } from '@/lib/supabase/server'

import PlacesAdmin, { type PlaceListItem } from './PlacesAdmin'

// 장소 관리 (T27). Server Component가 목록을 읽어 Client Component에 props로 넘긴다 —
// app/(app)/page.tsx · /dev와 같은 패턴 (ARCHITECTURE.md §21).
//
// lib/supabase/server.ts로 읽는다 — RLS places_read가 active 회원에게 SELECT를 허용하므로
// 충분하다. admin 클라이언트는 여기서 쓰지 않는다 (§3). 좌표는 select도 하지 않는다 —
// 이 화면은 좌표를 보여주지 않는다 (§23 P4).
//
// 요청 쿠키를 타므로 이 라우트는 자동으로 dynamic이다. export const dynamic은 쓰지 않는다 (§15).
// 접근 제어는 proxy.ts T14 가드가 하고, 쓰기 인가는 actions/places.ts가 다시 본다.

const LOAD_ERROR_MESSAGE = '장소 목록을 불러오지 못했습니다'

type PlaceRow = {
  id: string
  name: string
  default_radius: number
  is_active: boolean
  created_at: string
}

export default async function PlacesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('places')
    .select('id, name, default_radius, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[places] list query failed', { code: error.code })
  }

  // 화면이 쓰는 모양으로만 넘긴다. 등록일은 KST 날짜 — Vercel의 TZ는 UTC라 lib/kst.ts로 고정한다.
  const places: PlaceListItem[] = ((data ?? []) as PlaceRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    radius: row.default_radius,
    createdDate: kstDateString(new Date(row.created_at)),
    isActive: row.is_active,
  }))

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6 text-foreground">
      <h1 className="text-2xl font-bold">장소 관리</h1>
      <PlacesAdmin places={places} loadError={error ? LOAD_ERROR_MESSAGE : null} />
    </main>
  )
}
