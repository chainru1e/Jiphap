// 브라우저용 Supabase 클라이언트. Client Component에서만 쓴다.
//
// publishable 키는 브라우저 노출을 전제로 한 값이다 (ARCHITECTURE.md §12).
// 이 클라이언트는 RLS 아래에서 읽기만 할 수 있다 — check_ins · sessions · profiles에
// 클라이언트용 INSERT/UPDATE/DELETE 정책이 없어 쓰기는 기본 거부에 걸린다 (§3).
// 쓰기는 전부 Server Action → admin.ts 경로로 간다.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // env는 반드시 process.env.NEXT_PUBLIC_XXX 형태의 정적 접근으로만 읽는다.
  // 동적 접근(process.env[name])은 빌드 시 인라인되지 않아 브라우저에서 undefined가 된다.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
