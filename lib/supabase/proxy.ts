// proxy.ts(루트)용 Supabase 클라이언트. 매 요청마다 세션 쿠키를 갱신하는 것이 유일한 역할이다.
//
// server.ts의 setAll은 Server Component 렌더 중에는 쿠키를 쓸 수 없어 실패를 삼킨다.
// 그 공백을 여기서 메운다 — Proxy는 응답을 직접 만드는 자리라 Set-Cookie를 실을 수 있다.
//
// 쿠키 어댑터는 getAll / setAll 두 개만 구현한다 (server.ts와 같은 이유).
// setAll은 request.cookies와 response.cookies 양쪽에 쓴다. request 쪽에 써야 같은 요청 안의
// 이후 읽기(예: proxy.ts의 profiles 조회)가 갱신된 토큰을 보고, response 쪽에 써야
// 브라우저가 갱신된 토큰을 받는다. Supabase 공식 middleware 패턴 그대로다.
//
// 여기서는 리다이렉트하지 않는다. 판단은 proxy.ts가 한다.

import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

type Supabase = ReturnType<typeof createServerClient>

export async function updateSession(
  request: NextRequest,
): Promise<{ supabase: Supabase; response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          // 갱신된 request 쿠키가 다운스트림(RSC · Server Action)에도 보이도록
          // response를 새로 만든다. 그 위에 Set-Cookie를 싣는다.
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // 반드시 getUser()다. 세션을 그대로 돌려주는 쪽 API는 쿠키에 든 토큰을 검증 없이 믿는다.
  // getUser는 Supabase Auth 서버에 검증을 요청하고, 만료가 가까우면 토큰을 갱신해
  // 위 setAll을 호출한다. 그 갱신 쿠키가 이 응답에 실려야 server.ts의 setAll 실패를
  // 메울 수 있으므로(server.ts 주석 참고) 반드시 getUser여야 한다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, response, user }
}
