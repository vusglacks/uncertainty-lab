// 실험 목록을 브라우저 localStorage에 저장한다.
// 6차시에 이 파일만 Supabase 버전으로 바꾸면 화면 코드는 그대로 쓸 수 있다.

const KEY = 'uncertainty-lab:experiments'

// 저장된 실험 전체를 배열로 읽는다. 없거나 깨졌으면 빈 배열.
export function listExperiments() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

export function getExperiment(id) {
  return listExperiments().find((e) => e.id === id) ?? null
}

// 새 실험이면 추가, 있으면 교체. 수정 시각을 갱신한다.
export function saveExperiment(exp) {
  const all = listExperiments()
  const next = { ...exp, updatedAt: new Date().toISOString() }
  const i = all.findIndex((e) => e.id === exp.id)
  if (i === -1) all.push(next)
  else all[i] = next
  localStorage.setItem(KEY, JSON.stringify(all))
  return next
}

export function deleteExperiment(id) {
  const rest = listExperiments().filter((e) => e.id !== id)
  localStorage.setItem(KEY, JSON.stringify(rest))
}
