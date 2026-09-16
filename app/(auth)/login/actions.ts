'use server'

// 카카오 로그인 진입점. 브라우저가 아니라 서버에서 signInWithOAuth를 부른다.
//
// PKCE의 code verifier는 이 호출 시점에 쿠키로 심겨야 콜백(app/auth/callback)의
// exchangeCodeForSession이 읽을 수 있다. Server Action은 쿠키를 쓸 수 있는 자리라
// lib/supabase/server.ts의 setAll이 여기서 실제로 동작한다.
//
// 카카오 REST API 키·Client Secret은 이 코드에 없다. 코드 교환은 Supabase 서버가 하고,
// 그 값은 Supabase 대시보드에만 있다 (ARCHITECTURE.md §12).

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// origin을 환경변수로 박지 않는 이유: 로컬(localhost:3000) · Vercel 프리뷰 · 프로덕션
// 도메인이 전부 다르다. 요청이 온 곳으로 돌려보내야 하므로 요청 헤더에서 구한다.
// Vercel 같은 프록시 뒤에서는 실제 호스트가 x-forwarded-host로 넘어온다.
function resolveOrigin(h: Headers): string | null {
  const origin = h.get('origin')
  if (origin) return origin

  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return null

  const proto = h.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

export async function signInWithKakao() {
  // Next.js 16에서 headers()는 async다 (ARCHITECTURE.md §15)
  const origin = resolveOrigin(await headers())
  if (!origin) redirect('/login?error=oauth')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: `${origin}/auth/callback` },
  })

  // redirect()는 예외를 던지는 방식이라 try/catch 안에 두면 잡혀 버린다.
  // 그래서 try 없이 조건 분기로만 부른다. 에러도 throw하지 않고 로그인 화면으로
  // 돌려보낸다 — 사용자가 볼 화면은 스택 트레이스가 아니라 "다시 시도" 안내여야 한다.
  if (error || !data.url) redirect('/login?error=oauth')
  redirect(data.url)
}
