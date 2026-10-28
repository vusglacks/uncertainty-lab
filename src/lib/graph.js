// ============================================================
//  그래프 블록의 자료 만들기 (화면 코드와 분리한 순수 함수들)
//  1) buildGraph : x축·y축으로 고른 측정 블록 -> 점 목록, 오차막대, 추세선
//  2) niceTicks  : 축에 찍을 "깔끔한" 눈금 (0, 2, 4, 6 … 처럼)
//  3) axisDomain : 점과 오차막대가 모두 들어가는 축 범위
// ============================================================
import { measureStats } from './stats.js'
import { fitCurve } from './regression.js'

function fail(message) {
  return { ok: false, message }
}

// 같은 이름이 여럿이면 가장 가까운(바로 위쪽) 블록을 쓴다. 계산 블록과 같은 규칙.
function nearestAbove(blocksAbove, name) {
  return [...blocksAbove].reverse().find((b) => b.name === name)
}

function label(block) {
  return block.unit ? `${block.name} (${block.unit})` : block.name
}

// 그래프 블록 하나의 자료를 만든다.
//   block       : { xName, yName, fit }  (fit: 'none' | 'linear' | 'origin' | 'quadratic' | 'power' | 'exponential' | 'log')
//   blocksAbove : 이 그래프 블록보다 위에 있는 블록들
//
// 점은 x축 블록과 y축 블록의 "같은 순서의 값"끼리 짝지어 만든다.
//   (x블록의 i번째 값, y블록의 i번째 값)  — 예) 길이를 바꿔 가며 잰 값들과 그때의 주기들
// 오차막대는 각 블록에 입력한 B형 불확도(기기 최소눈금 등)를 모든 점에 같게 쓴다.
//
// 반환
//   아직 축을 안 골랐으면  { ok: false, empty: true, message }
//   실패하면               { ok: false, message }
//   성공하면 { ok: true, points:[{x,y,ux,uy}], xLabel, yLabel, hasXErr, hasYErr,
//              fit: fitCurve 결과 | null, fitMessage, warnings:[...] }
export function buildGraph(block, blocksAbove) {
  if (!block.xName || !block.yName) {
    return { ok: false, empty: true, message: 'x축과 y축을 고르면 그래프가 그려져요.' }
  }

  const axes = []
  for (const [축, name] of [['x', block.xName], ['y', block.yName]]) {
    const b = nearestAbove(blocksAbove, name)
    if (!b) return fail(`${축}축 '${name}' 이름의 블록이 위쪽에 없어요`)
    if (b.type !== 'measure') {
      return fail(`${축}축 '${name}' 은(는) 계산 블록이에요. 그래프 축에는 측정 블록(측정값 목록)만 쓸 수 있어요`)
    }
    const s = measureStats(b)
    if (s.typeBError) return fail(`${축}축 '${name}' 측정 블록의 ${s.typeBError}`)
    if (s.n === 0) return fail(`${축}축 '${name}' 측정 블록에 측정값이 없어요`)
    axes.push({ block: b, stats: s })
  }
  const [X, Y] = axes

  const warnings = []
  const n = Math.min(X.stats.n, Y.stats.n)
  if (X.stats.n !== Y.stats.n) {
    warnings.push(`x값은 ${X.stats.n}개, y값은 ${Y.stats.n}개라서 앞에서부터 ${n}쌍만 그렸어요`)
  }

  // B형 불확도를 입력한 축에만 오차막대를 그린다.
  const ux = X.stats.uBGiven ? X.stats.uB : 0
  const uy = Y.stats.uBGiven ? Y.stats.uB : 0
  const points = []
  for (let i = 0; i < n; i++) {
    points.push({ x: X.stats.values[i], y: Y.stats.values[i], ux, uy })
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
    xLabel: label(X.block),
    yLabel: label(Y.block),
    xName: X.block.name,
    yName: Y.block.name,
    hasXErr: ux > 0,
    hasYErr: uy > 0,
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
