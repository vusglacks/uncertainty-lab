// ============================================================
//  계산 블록 ↔ engine.js 연결 (화면 코드와 분리)
//  engine.js 는 "이름 -> {value, uncertainty}" 표를 받아 계산하므로,
//  여기서는 수식을 먼저 "측정 블록 변수만 남도록" 펼친 뒤(expand.js),
//  변수마다 위쪽 측정 블록을 찾아 그 표를 만들어 넘기고,
//  돌려받은 결과를 화면에 보여주기 좋은 모양으로 정리한다.
//  engine.js 의 계산 코드는 전혀 고치지 않는다.
//
//  계산 블록은 두 가지 결과를 가진다.
//    evaluateCalc : 값 하나 (측정 블록의 평균과 합성표준불확도로 계산)
//    evaluateRows : 행별 값 목록 (측정 블록의 i번째 값끼리 계산) — 그래프 축으로 쓴다
// ============================================================
import { parse, propagate, formatResult } from './engine.js'
import { measureStats } from './stats.js'
import { compileFormula } from './expand.js'
import { partialText, simplifiedText, angleVarIds } from './symbolic.js'
import { analyzeUnits } from './unitcheck.js'

function fail(message) {
  return { ok: false, message }
}

// 펼친 식에 남은 측정 블록마다 통계를 구하고, 쓸 수 없는 블록이면 이유를 돌려준다.
// 반환: { error } 또는 { stats: [{ v, s }] }  (v: 변수 정보, s: measureStats 결과)
function statsOf(vars) {
  const stats = []
  for (const v of vars) {
    const s = measureStats(v.block)
    if (s.mean === null) return { error: `'${v.name}' 측정 블록에 측정값이 없어요` }
    if (s.typeBError) return { error: `'${v.name}' 측정 블록의 ${s.typeBError}` }
    stats.push({ v, s })
  }
  return { stats }
}

// 계산 블록 하나를 계산한다. (값 하나: 평균과 합성표준불확도 기준)
//   formula    : 수식 문자열 (예: "4*pi^2*L / T^2")
//   blocksAbove: 이 계산 블록보다 위에 있는 블록들 (위→아래 순서 그대로)
//   angleUnit  : 'deg' | 'rad'  (삼각함수 입력의 각도 단위)
//
// 수식에는 위쪽 측정 블록의 이름과 위쪽 계산 블록의 이름을 쓸 수 있다.
// 계산 블록 이름은 그 블록의 식으로 펼쳐서 한 번에 미분하므로,
// 같은 측정값이 여러 경로로 들어가도 불확도가 맞게 전파된다.
//
// 반환
//   수식이 비어 있으면  { empty: true }
//   계산에 실패하면     { ok: false, message }
//   성공하면            { ok: true, value, uncertainty, text, terms, expanded, explain, units }
//     text     : 유효숫자를 맞춘 "값 ± 불확도"
//     terms    : 변수(측정 블록)별 { name, share(%), inputText } — 오차 기여도가 큰 순서
//     expanded : 계산 블록 이름을 펼쳤을 때만 펼친 식 글자, 아니면 null
export function evaluateCalc(formula, blocksAbove, angleUnit) {
  if (!formula || !formula.trim()) return { empty: true }

  // 1) 수식을 펼친다. 문법 오류·없는 이름은 여기서 이유와 함께 걸러진다.
  const c = compileFormula(formula, blocksAbove)
  if (!c.ok) return fail(c.message)

  // 2) 남은 측정 블록마다 평균(값)과 합성표준불확도(불확도)를 넣는다.
  const got = statsOf(c.vars)
  if (got.error) return fail(got.error)
  const inputs = {}
  const nameOf = {}
  const inputTexts = {}
  const statOf = {}
  for (const { v, s } of got.stats) {
    if (s.uC === null) {
      return fail(`'${v.name}' 의 불확도를 계산할 수 없어요 (측정값 2개 이상, 또는 B형 불확도가 필요해요)`)
    }
    inputs[v.id] = { value: s.mean, uncertainty: s.uC }
    nameOf[v.id] = v.name
    inputTexts[v.id] = formatResult(s.mean, s.uC).text
    statOf[v.id] = s
  }

  // 3) engine.js 로 값과 불확도를 계산한다. (자동 미분 -> 오차 전파)
  //    도(°) 단위일 때 삼각함수 안의 변수만 라디안으로 바꾸는 것도 engine.js 가 처리한다.
  let r
  try {
    r = propagate(c.expr, inputs, { degrees: angleUnit === 'deg' })
  } catch (e) {
    return fail(e.message)
  }
  if (!isFinite(r.value) || !isFinite(r.uncertainty)) {
    return fail('결과가 숫자가 아니에요. 수식과 입력값(예: 0으로 나누기, 범위 밖 값)을 확인하세요')
  }

  return {
    ok: true,
    value: r.value,
    uncertainty: r.uncertainty,
    text: formatResult(r.value, r.uncertainty).text, // 유효숫자 처리
    // 오차 기여도(%) = (∂f/∂xi · u(xi))² / u_c² × 100  — engine.js 가 이미 share 로 계산해 둠
    terms: r.terms.map((t) => ({ name: nameOf[t.name], share: t.share, inputText: inputTexts[t.name] })),
    expanded: c.usedCalcs.length ? c.text : null,
    explain: explainTerms(c, r, nameOf, statOf, angleUnit),
    units: unitInfo(c, angleUnit), // 결과 단위와 단위 경고
  }
}

// 단위 검사 결과를 화면에 쓰기 좋게 정리한다. 단위 검사가 실패해도 계산 결과는 그대로 보여준다.
//   { text: "m/s²", named: "N" | null, warnings: [...], notes: [...] }
function unitInfo(c, angleUnit) {
  try {
    const u = analyzeUnits(c.expr, c.vars, angleUnit)
    return { text: u.text, named: u.named, warnings: u.warnings, notes: u.notes }
  } catch {
    return { text: '', named: null, warnings: [], notes: [] }
  }
}

// "계산 과정 보기"에 쓸 자료: 편미분식, 변수별 값·불확도, 항(∂f/∂x·u), 기여율.
//   u_c(f) = √( Σ (∂f/∂xᵢ · u(xᵢ))² )  이므로 항 하나가 (∂f/∂xᵢ · u(xᵢ)) 이다.
// 편미분 "값"은 engine.js 의 자동 미분이 구한 것이고, 편미분 "식"은 symbolic.js 가 기호로 미분한 것이다.
// 도(°) 단위에서 삼각함수 안의 변수는 라디안으로 바꿔서 미분하므로, 그 변수의 편미분·u 는 라디안 기준이다.
function explainTerms(c, r, nameOf, statOf, angleUnit) {
  const angleIds = angleUnit === 'deg' ? angleVarIds(parse(c.expr)) : new Set()
  const show = (id) => nameOf[id] ?? id
  const rows = r.terms.map((t) => {
    let text = null
    try {
      text = partialText(c.expr, t.name, show, { degrees: angleUnit === 'deg' })
    } catch {
      text = null // 기호 미분에 실패해도 계산 결과 자체는 그대로 보여준다
    }
    return {
      name: nameOf[t.name],
      x: statOf[t.name].mean, //        변수의 값(평균), 입력한 단위 그대로
      u: statOf[t.name].uC, //          변수의 합성표준불확도, 입력한 단위 그대로
      partialText: text, //             ∂f/∂x 식 (너무 길면 null)
      partial: t.partial, //            ∂f/∂x 값 (각도 변수는 라디안 기준)
      term: t.contribution, //          ∂f/∂x · u(x)  (각도 변수는 u 를 라디안으로 바꾼 값)
      share: t.share, //                기여율 (%)
      radians: angleIds.has(t.name), // 도 → 라디안으로 바꿔서 계산했는가
    }
  })
  let simplified = null
  try {
    simplified = simplifiedText(c.expr, show)
  } catch {
    simplified = null
  }
  return {
    formulaText: simplified ?? c.text, // 정리한 식 (계산 블록 이름은 펼친 상태)
    rows,
    sumSquares: rows.reduce((sum, row) => sum + row.term ** 2, 0), // Σ 항², u_c² 와 같다
    angleNotes: rows
      .filter((row) => row.radians)
      .map((row) => `${row.name}: 도(°)를 라디안으로 바꿔 미분했어요 (u = ${Number(row.u.toPrecision(6))}° → ${Number(((row.u * Math.PI) / 180).toPrecision(6))} rad). 편미분과 항은 라디안 기준이에요`),
  }
}

// 계산 블록을 "행별로" 계산한다. (그래프 축으로 쓰는 값 목록)
// 측정 블록의 i번째 값끼리 모아서 i번째 행을 계산한다.
//   예) T = [1.27, 1.55, 1.79], 수식 T^2  ->  행 3개: 1.61, 2.40, 3.20
// 행마다 불확도는 각 측정 블록의 B형 불확도를 식에 따라 전파한 값이다. (B형을 안 쓰면 0)
//
// 행 개수 규칙
//   - 값이 2개 이상인 블록들의 개수가 다르면 가장 적은 쪽에 맞추고 경고(warnings)를 돌려준다
//   - 값이 1개인 블록은 상수로 보고 모든 행에 같은 값을 쓴다 (notes 로 알려준다)
//
// 반환
//   수식이 비어 있으면  { empty: true }
//   실패하면            { ok: false, message }
//   성공하면            { ok: true, rows: [{ value, u }], warnings: [글자], notes: [글자] }
export function evaluateRows(formula, blocksAbove, angleUnit) {
  if (!formula || !formula.trim()) return { empty: true }

  const c = compileFormula(formula, blocksAbove)
  if (!c.ok) return fail(c.message)
  const got = statsOf(c.vars)
  if (got.error) return fail(got.error)

  const warnings = []
  const notes = []
  const multi = got.stats.filter(({ s }) => s.n >= 2) // 값이 여러 개인 블록 = 행을 만드는 블록
  const consts = got.stats.filter(({ s }) => s.n === 1)

  // 행 개수: 값이 여러 개인 블록 중 가장 적은 개수. 모두 1개(또는 변수 없음)면 1행.
  const N = multi.length ? Math.min(...multi.map(({ s }) => s.n)) : 1
  if (new Set(multi.map(({ s }) => s.n)).size > 1) {
    const list = multi.map(({ v, s }) => `${v.name} ${s.n}개`).join(', ')
    warnings.push(`행 개수가 달라요 (${list}). 가장 적은 ${N}개 행만 계산했어요`)
  }
  if (multi.length && consts.length) {
    notes.push(`${consts.map(({ v }) => v.name).join(', ')} 은(는) 값이 1개라서 모든 행에 같은 값으로 썼어요`)
  }

  const degrees = angleUnit === 'deg'
  const rows = []
  for (let i = 0; i < N; i++) {
    const inputs = {}
    for (const { v, s } of got.stats) {
      inputs[v.id] = { value: s.n === 1 ? s.values[0] : s.values[i], uncertainty: s.uBGiven ? s.uB : 0 }
    }
    let r
    try {
      r = propagate(c.expr, inputs, { degrees })
    } catch (e) {
      return fail(`${i + 1}번째 행을 계산할 수 없어요: ${e.message}`)
    }
    if (!isFinite(r.value) || !isFinite(r.uncertainty)) {
      return fail(`${i + 1}번째 행의 결과가 숫자가 아니에요 (0으로 나누기, 범위 밖 값 등)`)
    }
    rows.push({ value: r.value, u: r.uncertainty })
  }
  return { ok: true, rows, warnings, notes, units: unitInfo(c, angleUnit) }
}
