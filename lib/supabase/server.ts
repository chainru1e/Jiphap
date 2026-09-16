// 서버용 Supabase 클라이언트. Server Component · Route Handler · Server Action에서 쓴다.
//
// 요청 쿠키의 사용자 세션으로 인증되므로 RLS가 그대로 적용된다 (ARCHITECTURE.md §3).
// RLS를 우회해야 하는 쓰기는 이 클라이언트가 아니라 admin.ts를 쓴다.
//
// 쿠키 어댑터는 getAll / setAll 두 개만 구현한다. @supabase/ssr가 현재 요구하는
// 인터페이스가 이것이고, 옛 get · set · remove 방식과 @supabase/auth-helpers-nextjs는
// 쓰지 않는다.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Next.js 16에서 cookies()는 async다. await 없이 쓰면 조용히 깨진다 (§15).
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component 렌더 중에는 쿠키를 쓸 수 없다. Set-Cookie는
            // Server Action · Route Handler에서만 가능하고, 렌더 중 set은 예외를 던진다.
            // 여기서 실패해도 세션이 끊기지는 않는다 — 토큰 갱신(refresh)은 T13의
            // proxy.ts가 매 요청마다 담당하기 때문이다. 그래서 삼킨다.
          }
        },
      },
    },
  )
}
