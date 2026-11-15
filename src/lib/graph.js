// ============================================================
//  그래프 블록의 자료 만들기 (화면 코드와 분리한 순수 함수들)
//  1) buildGraph : x축·y축으로 고른 블록(측정 블록 또는 계산 블록) -> 점 목록, 오차막대, 추세선
//  2) niceTicks  : 축에 찍을 "깔끔한" 눈금 (0, 2, 4, 6 … 처럼)
//  3) axisDomain : 점과 오차막대가 모두 들어가는 축 범위
// ============================================================
import { measureStats } from './stats.js'
import { evaluateRows } from './calc.js'
import { fitCurve } from './regression.js'

function fail(message) {
  return { ok: false, message }
}

// 같은 이름이 여럿이면 가장 가까운(바로 위쪽) 블록을 쓴다. 계산 블록과 같은 규칙.
// 반환: 위치(index), 없으면 -1
function nearestIndex(blocksAbove, name) {
  for (let i = blocksAbove.length - 1; i >= 0; i--) if (blocksAbove[i].name === name) return i
  return -1
}

function label(block) {
  return block.unit ? `${block.name} (${block.unit})` : block.name
}

// 축 하나가 내놓는 "행 목록"을 만든다. 행 하나 = { value, u } (값과 그 점의 불확도)
//   측정 블록: 측정값 하나하나가 행. 불확도는 B형 불확도(입력했을 때만, 아니면 0)
//   계산 블록: 측정 블록의 i번째 값끼리 식을 계산한 행별 값. 불확도는 B형 불확도를 식에 따라 전파한 값
// 반환: { ok:false, message } 또는 { ok:true, rows, label, warnings }
function axisRows(축, name, blocksAbove, angleUnit) {
  const index = nearestIndex(blocksAbove, name)
  if (index < 0) return fail(`${축}축 '${name}' 이름의 블록이 위쪽에 없어요`)
  const b = blocksAbove[index]

  if (b.type === 'measure') {
    const s = measureStats(b)
    if (s.typeBError) return fail(`${축}축 '${name}' 측정 블록의 ${s.typeBError}`)
    if (s.n === 0) return fail(`${축}축 '${name}' 측정 블록에 측정값이 없어요`)
    const u = s.uBGiven ? s.uB : 0
    return { ok: true, rows: s.values.map((v) => ({ value: v, u })), label: label(b), warnings: [] }
  }

  if (b.type === 'calc') {
    // 계산 블록은 자기보다 위쪽 블록만 쓸 수 있으므로, 그 위치까지 잘라서 계산한다.
    const r = evaluateRows(b.formula, blocksAbove.slice(0, index), angleUnit)
    if (r.empty) return fail(`${축}축 '${name}' 계산 블록에 수식이 없어요`)
    if (!r.ok) return fail(`${축}축 '${name}' 계산 블록: ${r.message}`)
    return { ok: true, rows: r.rows, label: label(b), warnings: r.warnings.map((w) => `${name}: ${w}`) }
  }

  return fail(`${축}축 '${name}' 은(는) 그래프 축으로 쓸 수 없는 블록이에요`)
}

// 그래프 블록 하나의 자료를 만든다.
//   block       : { xName, yName, fit }  (fit: 'none' | 'linear' | 'origin' | 'quadratic' | 'power' | 'exponential' | 'log')
//   blocksAbove : 이 그래프 블록보다 위에 있는 블록들
//   angleUnit   : 'deg' | 'rad'  (축으로 고른 계산 블록의 삼각함수에 쓴다)
//
// 점은 x축과 y축의 "같은 순서의 행"끼리 짝지어 만든다.
//   (x축의 i번째 값, y축의 i번째 값)  — 예) 길이를 바꿔 가며 잰 값들과 그때의 주기들
// 오차막대는 각 점의 불확도다. 측정 블록은 B형 불확도를 모든 점에 같게,
// 계산 블록은 B형 불확도를 식에 따라 전파한 값을 점마다 쓴다.
//
// 반환
//   아직 축을 안 골랐으면  { ok: false, empty: true, message }
//   실패하면               { ok: false, message }
//   성공하면 { ok: true, points:[{x,y,ux,uy}], xLabel, yLabel, hasXErr, hasYErr,
//              fit: fitCurve 결과 | null, fitMessage, warnings:[...] }
export function buildGraph(block, blocksAbove, angleUnit = 'deg') {
  if (!block.xName || !block.yName) {
    return { ok: false, empty: true, message: 'x축과 y축을 고르면 그래프가 그려져요.' }
  }

  const X = axisRows('x', block.xName, blocksAbove, angleUnit)
  if (!X.ok) return X
  const Y = axisRows('y', block.yName, blocksAbove, angleUnit)
  if (!Y.ok) return Y

  const warnings = [...X.warnings, ...Y.warnings]
  const n = Math.min(X.rows.length, Y.rows.length)
  if (X.rows.length !== Y.rows.length) {
    warnings.push(`x값은 ${X.rows.length}개, y값은 ${Y.rows.length}개라서 앞에서부터 ${n}쌍만 그렸어요`)
  }

  const points = []
  for (let i = 0; i < n; i++) {
    points.push({ x: X.rows[i].value, y: Y.rows[i].value, ux: X.rows[i].u, uy: Y.rows[i].u })
  }

  let fit = null
  let fitMessage = ''
  // 추세선 유형(block.fit): 'none' 이면 그리지 않고, 나머지는 regression.js 의 fitCurve 가 맞춘다.
  if (block.fit && block.fit !== 'none') {
    const r = fitCurve(
      block.fit,
      points.map((p) => p.x),
      points.map((p) => p.y),
    )
    if (r.ok) fit = r
    else fitMessage = r.reason
  }

  return {
    ok: true,
    points,
    xLabel: X.label,
    yLabel: Y.label,
    xName: block.xName,
    yName: block.yName,
    hasXErr: points.some((p) => p.ux > 0),
    hasYErr: points.some((p) => p.uy > 0),
    fit,
    fitMessage,
    warnings,
  }
}

// 반올림 기준이 되는 "깔끔한 수" 하나를 고른다. (1, 2, 5, 10 × 10의 거듭제곱)
// round 가 true 면 가장 가까운 값, false 면 그 값 이상 중 가장 작은 값.
function niceNum(range, round) {
  const exp = Math.floor(Math.log10(range))
  const f = range / 10 ** exp // 1 이상 10 미만으로 맞춘 값
  let nf
  if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nf * 10 ** exp
}

// [lo, hi] 를 덮는 깔끔한 눈금을 만든다.
// 반환: { ticks:[숫자…], min, max, decimals }  (min/max 는 첫·마지막 눈금)
export function niceTicks(lo, hi, target = 6) {
  if (!(hi > lo)) {
    // 값이 하나뿐이거나 범위가 0이면 가운데에 두고 위아래로 조금 벌린다.
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1
    lo -= pad
    hi += pad
  }
  const range = niceNum(hi - lo, false)
  const step = niceNum(range / (target - 1), true)
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const min = Math.floor(lo / step + 1e-9) * step
  const max = Math.ceil(hi / step - 1e-9) * step
  const ticks = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toFixed(decimals + 2)))
  return { ticks, min: ticks[0], max: ticks[ticks.length - 1], decimals }
}

// 점들과 오차막대가 모두 들어가는 축 범위. key: 'x' | 'y', errKey: 'ux' | 'uy'
// 가장자리에 점이 붙지 않도록 양쪽에 범위의 5%씩 여유를 둔다.
export function axisDomain(points, key, errKey) {
  let lo = Infinity
  let hi = -Infinity
  for (const p of points) {
    lo = Math.min(lo, p[key] - p[errKey])
    hi = Math.max(hi, p[key] + p[errKey])
  }
  const pad = (hi - lo) * 0.05
  return niceTicks(lo - pad, hi + pad)
}
