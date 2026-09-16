// 접근 제어 — status별 화면 전환 (T13) + /admin/* role 가드 (T14).
//
// 이 가드는 화면 전환용이고 방어선이 아니다. Proxy는 낙관적 검사(optimistic check)용이며
// 세션 관리나 인가의 최종 방어선이 아니다 (ARCHITECTURE.md §15). 실제 방어는
// RLS(§3)와 Server Action 내부의 인증·인가 검증(§17)이 한다.
//
// Next.js 16: middleware.ts가 아니라 proxy.ts, export 이름은 proxy, 프로젝트당 한 개 (§15).

import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// 리다이렉트 판단을 건너뛰는 경로. 아직 없는 경로(/dev 등)는 넣지 않는다.
const PUBLIC_PATHS = ['/login', '/auth/callback']

export async function proxy(request: NextRequest) {
  // 공개 경로 포함 모든 요청에서 먼저 세션을 갱신한다. server.ts의 setAll이 렌더 중
  // 실패를 삼키는 대신 여기가 매 요청 토큰 갱신을 책임진다 (lib/supabase/proxy.ts).
  const { supabase, response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // redirect 응답에도 갱신된 쿠키를 복사한다. 갱신 쿠키를 잃으면 브라우저는 옛 토큰을
  // 계속 보내고, 다음 요청에서 또 갱신하는 루프가 된다.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    // 이미 로그인한 사람이 로그인 화면에 머물 이유가 없다
    if (user && pathname === '/login') return redirectTo('/')
    return response
  }

  if (!user) return redirectTo('/login')

  // 본인 행만 읽는다 (RLS profiles_self). single은 행이 없을 때 에러를 던지므로
  // maybeSingle로 받아 아래에서 "행 없음"을 직접 다룬다.
  // status와 role을 한 번의 쿼리로 함께 읽는다 — 매 요청마다 도는 자리다.
  const { data } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .maybeSingle()

  // 행이 없으면(트리거 이전 계정 등) 열어주지 않고 대기로 보낸다 (fail-closed).
  // "모르면 막는다"가 승인제의 기본값이다.
  const status = data?.status ?? 'pending'

  // status 판단이 먼저, role 판단은 active 안에서만. 승인되지 않은 계정은 role이
  // admin이어도 /admin에 못 들어간다.
  if (status === 'active') {
    if (pathname === '/pending') return redirectTo('/')

    // /admin/*는 admin만. role이 비어 있으면 member로 본다 (fail-closed).
    // 이 role 가드도 §15와 같이 화면 전환용 낙관적 검사이지 방어선이 아니다 —
    // 운영 기능의 실제 방어는 Server Action 내부의 role 검증(§17)이 한다.
    const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
    if (isAdminPath) {
      const role = data?.role ?? 'member'
      if (role !== 'admin') return redirectTo('/')
    }

    return response
  }

  // pending · rejected · inactive · 행 없음 → 대기 화면. 문구 차이는 화면이 담당한다.
  return pathname === '/pending' ? response : redirectTo('/pending')
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
