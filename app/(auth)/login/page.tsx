import { signInWithKakao } from './actions'

// Server Component다. 클라이언트 지시어를 붙이지 않는다 — form action으로 Server Action을
// 직접 부르므로 클라이언트 JS가 없어도 로그인이 된다.
export default async function LoginPage({
  searchParams,
}: {
  // Next.js 16에서 searchParams는 Promise다 (ARCHITECTURE.md §15)
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { error } = await searchParams
  const failed = error === 'oauth'

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-10 text-4xl font-bold tracking-tight">집합</h1>

      <form
        action={signInWithKakao}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        {/* 실패 이유는 버튼 바로 위에 둔다. "왜 안 되지"가 이 앱의 유일한 실패 모드다 */}
        {failed && (
          <p role="alert" className="text-center text-base font-semibold">
            로그인에 실패했습니다. 다시 시도해 주세요.
          </p>
        )}

        {/* 아침 7시 장갑 낀 손 기준 — 탭 영역 48px 이상, 전체 너비 */}
        <button
          type="submit"
          className="min-h-12 w-full rounded-xl bg-foreground px-5 text-lg font-bold text-background active:opacity-80"
        >
          카카오로 시작하기
        </button>
      </form>
    </main>
  )
}
