// ============================================================
//  내보내기 화면에 보여줄 "보고서용 결과" 만들기 (화면 코드와 분리한 순수 함수)
//  실험의 원본(측정값·수식·축 설정)에서 표 두 개(측정 결과, 계산 결과)와 그래프 자료를 매번 새로 계산한다.
//  계산 결과는 저장하지 않으므로, 계산 방식이 바뀌어도 예전 실험의 내보내기가 자동으로 새 값이 된다.
// ============================================================
import { measureStats, formatNumber } from './stats.js'
import { evaluateCalc } from './calc.js'
import { buildGraph } from './graph.js'
import { formatResult } from './engine.js'

export const MEASURE_HEADER = ['이름', '단위', '측정 횟수 n', '평균', '표준편차 s', 'A형 u_A', 'B형 u_B', '합성 u_c', '결과 (평균 ± u_c)']
export const CALC_HEADER = ['이름', '수식', '결과 (값 ± 불확도)', '오차 기여도']
export const SUMMARY_HEADER = ['계산 블록', '변수 x', '값', '불확도 u(x)', '편미분식 ∂f/∂x', '편미분 값', '항 ∂f/∂x·u', '기여율']

const DASH = '-'

// 측정 블록들 -> 표 (머리글 포함). 이름이 없는 블록도 한 줄로 넣는다.
function measureRows(blocks) {
  const rows = [MEASURE_HEADER]
  for (const b of blocks) {
    if (b.type !== 'measure') continue
    const s = measureStats(b)
    const unit = b.unit || ''
    rows.push([
      b.name || DASH,
      unit || DASH,
      String(s.n),
      s.mean === null ? DASH : formatNumber(s.mean),
      s.std === null ? DASH : formatNumber(s.std),
      s.uA === null ? DASH : formatNumber(s.uA),
      s.uBGiven ? formatNumber(s.uB) : DASH,
      s.uC === null ? DASH : formatNumber(s.uC),
      s.mean !== null && s.uC !== null ? `${formatResult(s.mean, s.uC).text}${unit ? ` ${unit}` : ''}` : DASH,
    ])
  }
  return rows
}

// 계산 블록들 -> 표. 계산할 수 없는 블록은 이유를 결과 칸에 적는다.
function calcRows(blocks, angleUnit) {
  const rows = [CALC_HEADER]
  blocks.forEach((b, i) => {
    if (b.type !== 'calc') return
    const r = evaluateCalc(b.formula, blocks.slice(0, i), angleUnit)
    let result = DASH
    let share = DASH
    if (r.ok) {
      result = r.text
      share = r.terms.length ? r.terms.map((t) => `${t.name} ${t.share.toFixed(1)}%`).join(', ') : DASH
    } else if (!r.empty) {
      result = `계산할 수 없음: ${r.message}`
    }
    rows.push([b.name || DASH, b.formula || DASH, result, share])
  })
  return rows
}

// 계산 블록마다 "불확도 총괄표"를 만든다: 변수별 값·불확도·편미분식·편미분 값·항·기여율과,
// 마지막 줄에 합성표준불확도 u_c = √(Σ 항²). 계산할 수 없는 블록은 건너뛴다.
function summaryRows(blocks, angleUnit) {
  const rows = [SUMMARY_HEADER]
  blocks.forEach((b, i) => {
    if (b.type !== 'calc') return
    const r = evaluateCalc(b.formula, blocks.slice(0, i), angleUnit)
    if (!r.ok || !r.explain) return
    const name = b.name || DASH
    for (const t of r.explain.rows) {
      rows.push([
        name,
        t.name,
        formatNumber(t.x),
        formatNumber(t.u),
        t.partialText ?? '(생략)',
        formatNumber(t.partial),
        formatNumber(t.term),
        `${t.share.toFixed(1)}%`,
      ])
    }
    rows.push([name, 'u_c = √(Σ 항²)', DASH, DASH, DASH, DASH, formatNumber(Math.sqrt(r.explain.sumSquares)), '100%'])
  })
  return rows
}

// 실험 전체 -> { measure, calc, summary, graphs }
//   measure, calc, summary : 표 (첫 줄이 머리글, 데이터 줄이 없으면 길이 1)
//   graphs        : [{ id, title, model }]  (model 은 graph.js 의 buildGraph 결과)
export function buildReport(blocks, angleUnit) {
  const graphs = []
  blocks.forEach((b, i) => {
    if (b.type !== 'graph') return
    graphs.push({
      id: b.id,
      title: `그래프 ${graphs.length + 1}`,
      model: buildGraph(b, blocks.slice(0, i), angleUnit),
    })
  })
  return { measure: measureRows(blocks), calc: calcRows(blocks, angleUnit), summary: summaryRows(blocks, angleUnit), graphs }
}
