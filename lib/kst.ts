// KST 시계 표기. 순수 함수만 둔다 — React·Supabase·브라우저 API를 import하지 않는다.
//
// lib/gate.ts는 '06:40' 같은 문자열을 호출자에게 받는다. 서버 액션(T21)이 그 호출자이고,
// Vercel 함수의 TZ는 UTC라 Intl·toLocaleString·getHours를 쓰면 문구가 실행 환경에 끌려간다.
// 그래서 epoch ms에 9시간을 더한 뒤 UTC 부품으로 읽는다. 한국은 서머타임이 없어
// 오프셋이 고정이고, 이 산술이 어떤 환경에서도 같은 답을 낸다.

const KST_OFFSET_MS = 9 * 60 * 60000

/** `Date`를 KST 'HH:mm'으로. Invalid Date는 RangeError — 조용히 'NaN:NaN'을 내보내지 않는다. */
export function formatKstHHmm(d: Date): string {
  const ms = d.getTime()
  if (Number.isNaN(ms)) {
    throw new RangeError('유효한 시각이 아닙니다.')
  }
  const shifted = new Date(ms + KST_OFFSET_MS)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
