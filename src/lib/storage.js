// 실험 저장·불러오기 — Supabase(experiments 표)를 사용한다.
// 모든 함수가 인터넷을 거치므로 async 이고, 실패하면 Error 를 던진다 (화면에서 잡아서 안내).
// "내 실험만 보인다"는 규칙은 여기 코드가 아니라 DB의 RLS 정책이 강제한다.
import { supabase } from './supabase'
import { rowToExperiment, experimentToRow } from './experimentRow'

function check(error, 행동) {
  if (error) throw new Error(`${행동}에 실패했어요: ${error.message}`)
}

// 내 실험 전체 (최근 수정순)
export async function listExperiments() {
  const { data, error } = await supabase
    .from('experiments')
    .select('*')
    .order('updated_at', { ascending: false })
  check(error, '실험 목록을 불러오지')
  return data.map(rowToExperiment)
}

// 실험 하나. 없거나 내 것이 아니면 null.
export async function getExperiment(id) {
  const { data, error } = await supabase.from('experiments').select('*').eq('id', id).maybeSingle()
  check(error, '실험을 불러오지')
  return data ? rowToExperiment(data) : null
}

// 새 실험이면 추가, 있으면 덮어쓰기 (upsert). 수정 시각은 저장할 때마다 갱신된다.
export async function saveExperiment(exp) {
  const { error } = await supabase.from('experiments').upsert(experimentToRow(exp))
  check(error, '저장하지')
}

export async function deleteExperiment(id) {
  const { error } = await supabase.from('experiments').delete().eq('id', id)
  check(error, '삭제하지')
}
