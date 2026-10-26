// 로그인 기능을 붙이기 전에 이 브라우저(localStorage)에 저장해 둔 실험을 읽는다.
// 새 저장소는 Supabase 이므로, 여기 있는 실험은 "내 계정으로 가져오기"에만 쓴다.

const KEY = 'uncertainty-lab:experiments'

export function listLocalExperiments() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

// 가져오기가 성공한 실험만 하나씩 지운다. 중간에 실패해도 남은 것은 그대로 보존된다.
export function removeLocalExperiment(id) {
  const rest = listLocalExperiments().filter((e) => e.id !== id)
  localStorage.setItem(KEY, JSON.stringify(rest))
}
