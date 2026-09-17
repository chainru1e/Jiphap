import MainScreen from '@/components/MainScreen'
import { getNextSession } from '@/lib/queries/nextSession'

// 사용자 메인 (T23). Server Component가 다음 세션을 조회해 Client Component에 props로 넘긴다 —
// /dev의 DevNextSession과 같은 패턴 (ARCHITECTURE.md §21).
//
// getNextSession은 요청 쿠키(server.ts)를 타므로 이 라우트는 자동으로 dynamic이다.
// export const dynamic은 쓰지 않는다 (§15).
//
// h-dvh는 여기 한 곳에만 둔다. MainScreen은 h-full이라 /dev의 375×667 프레임에도 그대로 들어간다.
export default async function HomePage() {
  const result = await getNextSession()

  return (
    <main className="flex h-dvh flex-col">
      <MainScreen result={result} />
    </main>
  )
}
