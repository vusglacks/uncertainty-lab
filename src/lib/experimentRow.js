// 앱에서 쓰는 실험 객체 ↔ Supabase 표(experiments)의 한 줄(row) 변환.
// 이름 규칙이 서로 달라서(앱: angleUnit / DB: angle_unit) 한곳에서만 바꿔주도록 분리했다.
// 계산 결과는 저장하지 않고, 원본(제목·각도 단위·블록들)만 저장한다.

// DB 한 줄 -> 앱 객체
export function rowToExperiment(row) {
  return {
    id: row.id,
    title: row.title,
    angleUnit: row.angle_unit,
    blocks: row.blocks ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// 앱 객체 -> DB 한 줄.
// user_id 는 보내지 않는다. 새로 만들 때는 DB가 로그인한 사용자 id(auth.uid())를 알아서 채우고,
// 고칠 때는 원래 주인 그대로 둔다. (클라이언트가 user_id 를 마음대로 정하게 두면 안 된다)
export function experimentToRow(exp, now = new Date()) {
  return {
    id: exp.id,
    title: exp.title,
    angle_unit: exp.angleUnit,
    blocks: exp.blocks,
    updated_at: now.toISOString(),
  }
}
