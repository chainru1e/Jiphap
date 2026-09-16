import { createClient } from '@/lib/supabase/server'

// 승인 대기 화면. Server Component다 — 읽기만 하고 아무 행동도 없으므로 클라이언트 JS가 필요 없다.
//
// 여기까지 오는 건 proxy.ts가 status !== 'active'로 판정한 사람뿐이다. 이 화면은 그 판정을
// 다시 하지 않고, 같은 행을 읽어 status별로 문구만 고른다. 버튼도 로그아웃도 없다 — 티켓 범위 밖이다.

const MESSAGES = {
  pending: '가입 신청이 접수되었습니다. 운영진 승인 후 이용할 수 있습니다.',
  rejected: '가입이 승인되지 않았습니다. 운영진에게 문의해 주세요.',
  inactive: '이용이 중지된 계정입니다. 운영진에게 문의해 주세요.',
} as const

type Status = keyof typeof MESSAGES

function isKnownStatus(value: unknown): value is Status {
  return typeof value === 'string' && value in MESSAGES
}

export default async function PendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // RLS profiles_self가 본인 행만 열어주지만, active 회원에게는 profiles_roster로 여러 행이
  // 보일 수 있다. eq로 본인 행 하나로 좁혀야 maybeSingle이 안전하다.
  const { data } = user
    ? await supabase
        .from('profiles')
        .select('status, display_name')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null }

  // 행이 없으면 pending으로 취급한다 (proxy.ts와 같은 fail-closed 기준)
  const status: Status = isKnownStatus(data?.status) ? data.status : 'pending'
  const displayName = data?.display_name

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 text-foreground">
      <h1 className="mb-10 text-4xl font-bold tracking-tight">집합</h1>

      <section className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {displayName && (
          <p className="text-xl font-semibold">{displayName}님</p>
        )}

        {/* 색은 "대기" 축 하나만 쓴다. 이 화면에는 활성 상태가 없다 */}
        <p className="text-base font-semibold text-zinc-500 dark:text-zinc-400">
          승인 대기 중
        </p>

        <p className="text-lg leading-relaxed">{MESSAGES[status]}</p>
      </section>
    </main>
  )
}
