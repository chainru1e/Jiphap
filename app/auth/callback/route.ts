// OAuth 콜백. Supabase가 카카오 인증을 마치고 ?code=... 를 붙여 여기로 돌려보낸다.
//
// Route Handler는 쿠키를 쓸 수 있으므로 lib/supabase/server.ts의 setAll이 실제로
// 동작하는 곳이다. exchangeCodeForSession이 성공하면 세션 쿠키(sb-*-auth-token)가
// 이 응답에 실려 브라우저에 심긴다. Server Component 렌더 중이었다면 불가능했다.
//
// profiles의 pending 행은 여기서 만들지 않는다. auth.users INSERT에 걸린
// on_auth_user_created 트리거가 만든다 (SCHEMA.sql).

import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 오픈 리다이렉트 방지. next는 우리 앱 안의 경로일 때만 쓴다.
//   '//evil.com'   → 프로토콜 상대 URL이라 외부로 튄다
//   'https://...'  → 절대 URL이라 외부로 튄다
// 둘 다 거르고 나면 '/'로 시작하는 앱 내부 경로만 남는다.
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  // redirect()는 예외를 던지므로 try/catch 밖에서만 부른다
  if (!code) redirect('/login?error=oauth')

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) redirect('/login?error=oauth')
  redirect(next)
}
