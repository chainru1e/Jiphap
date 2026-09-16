import 'server-only'

// service_role 클라이언트. Server Action · Route Handler 내부에서만 쓴다.
//
// SUPABASE_SECRET_KEY(sb_secret_...)는 Postgres의 service_role 롤로 인증되어
// RLS를 전부 우회한다 (ARCHITECTURE.md §3). 그래서 두 가지가 절대 조건이다.
//   1. Server Action은 직접 POST로 도달 가능한 공개 엔드포인트다 (§17).
//      이 클라이언트를 만들기 전에 액션 안에서 인증·인가를 직접 검증한다.
//   2. 클라이언트 번들에 절대 들어가면 안 된다. 위 'server-only' import가
//      Client Component에서의 import를 빌드 타임에 막는다. NEXT_PUBLIC_ 접두사 금지.

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      // 서버에는 사용자 세션이라는 개념이 없다. 요청마다 새로 만들고 버리므로
      // 세션을 저장하거나 갱신할 이유가 없고, URL에서 토큰을 찾을 일도 없다.
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  )
}
