// ============================================================
//  직선 추세선(최소제곱 선형 회귀) — 그래프 블록의 계산부
//  점들 (x1,y1) … (xn,yn) 에 가장 가깝게 지나는 직선 y = a·x + b 를 구한다.
//  "가깝다"의 기준: 각 점의 세로 거리(잔차)를 제곱해서 모두 더한 값이 가장 작은 직선.
// ============================================================

// 반환
//   실패:  { ok: false, reason }                       (점이 2개 미만, x가 모두 같음)
//   성공:  { ok: true, n, slope, intercept, r2, slopeErr, interceptErr }
//     slope(a)      : 기울기
//     intercept(b)  : 절편
//     r2            : 결정계수 R² (0~1, 1에 가까울수록 점들이 직선 위에 있음). y가 모두 같으면 null
//     slopeErr      : 기울기의 표준오차 (점이 3개 이상일 때만, 아니면 null)
//     interceptErr  : 절편의 표준오차 (점이 3개 이상일 때만, 아니면 null)
export function linearFit(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { ok: false, reason: '추세선은 점이 2개 이상일 때 그려요' }

  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n // x 평균
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n // y 평균

  // 편차 제곱합: Sxx = Σ(x-평균x)², Syy = Σ(y-평균y)², Sxy = Σ(x-평균x)(y-평균y)
  let sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  if (sxx === 0) return { ok: false, reason: 'x값이 모두 같아서 추세선을 그릴 수 없어요' }

  // 최소제곱해: 기울기 a = Sxy / Sxx,  직선은 반드시 (평균x, 평균y)를 지나므로 b = 평균y - a·평균x
  const slope = sxy / sxx
  const intercept = my - slope * mx

  // 잔차제곱합 SSE = Σ(y - (a·x+b))²  (직선에서 점들이 얼마나 벗어났는지)
  let sse = 0
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - (slope * xs[i] + intercept)
    sse += resid * resid
  }

  // 결정계수 R² = 1 - SSE/Syy  (y의 전체 흩어짐 중 직선으로 설명되는 비율)
  const r2 = syy === 0 ? null : Math.min(1, Math.max(0, 1 - sse / syy))

  // 표준오차: 직선이 a, b 두 개를 데이터에서 정했으므로 자유도는 n-2.
  //   s² = SSE/(n-2),  u(a) = √(s²/Sxx),  u(b) = √(s²·(1/n + 평균x²/Sxx))
  let slopeErr = null
  let interceptErr = null
  if (n >= 3) {
    const s2 = sse / (n - 2)
    slopeErr = Math.sqrt(s2 / sxx)
    interceptErr = Math.sqrt(s2 * (1 / n + (mx * mx) / sxx))
  }

  return { ok: true, n, slope, intercept, r2, slopeErr, interceptErr }
}

// ============================================================
//  여러 가지 추세선 유형
//  직선(linear)을 바탕으로, 변수를 바꾸면 직선이 되는 곡선들은 "직선 맞추기"로 풀고,
//  2차 곡선만 연립방정식을 직접 푼다.
//    origin      y = a·x           원점을 지나는 직선
//    quadratic   y = a·x² + b·x + c 2차 곡선
//    power       y = a·x^b         거듭제곱  →  ln y = ln a + b·ln x  (직선)
//    exponential y = a·e^(b·x)     지수      →  ln y = ln a + b·x     (직선)
//    log         y = a·ln(x) + b   로그      →  y = a·(ln x) + b      (직선)
// ============================================================

export const FIT_LABELS = {
  linear: '직선',
  origin: '원점을 지나는 직선',
  quadratic: '2차 곡선',
  power: '거듭제곱',
  exponential: '지수',
  log: '로그',
  none: '없음',
}

const sum = (arr) => arr.reduce((s, v) => s + v, 0)

// 결정계수 R² = 1 - SSE/SST. SSE: 곡선에서 벗어난 정도(잔차제곱합), SST: y 자체의 흩어짐.
// y가 모두 같으면(SST=0) 정의할 수 없어서 null.
function r2Of(ys, yhat) {
  const my = sum(ys) / ys.length
  const sst = sum(ys.map((y) => (y - my) ** 2))
  if (sst === 0) return null
  const sse = sum(ys.map((y, i) => (y - yhat[i]) ** 2))
  return 1 - sse / sst
}

// 3×3 연립방정식 M·v = t 를 가우스 소거법(부분 피벗)으로 푼다. 풀 수 없으면 null.
function solve3(M, t) {
  const a = M.map((row, i) => [...row, t[i]])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    if (Math.abs(a[p][c]) < 1e-12) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    for (let r = c + 1; r < 3; r++) {
      const f = a[r][c] / a[c][c]
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k]
    }
  }
  const v = [0, 0, 0]
  for (let r = 2; r >= 0; r--) {
    v[r] = (a[r][3] - sum([0, 1, 2].filter((k) => k > r).map((k) => a[r][k] * v[k]))) / a[r][r]
  }
  return v
}

// 유형을 골라 추세선을 맞춘다.
// 반환
//   실패: { ok: false, reason }
//   성공: { ok: true, type, n, coef:{a,b,c}, r2, predict(x), params:[{label, value, err}] }
//     r2 : 직선·원점·2차·로그는 y값에 대한 R², 거듭제곱·지수는 로그를 취한 값(ln y)에 대한 R²
//          (엑셀의 추세선 R²와 같은 방식)
//     params 의 err 는 표준오차(구할 수 없으면 null)
export function fitCurve(type, xs, ys) {
  const n = Math.min(xs.length, ys.length)
  const x = xs.slice(0, n)
  const y = ys.slice(0, n)

  if (type === 'linear') {
    const r = linearFit(x, y)
    if (!r.ok) return r
    return {
      ok: true, type, n, coef: { a: r.slope, b: r.intercept }, r2: r.r2,
      predict: (v) => r.slope * v + r.intercept,
      params: [
        { label: '기울기 a', value: r.slope, err: r.slopeErr },
        { label: '절편 b', value: r.intercept, err: r.interceptErr },
      ],
    }
  }

  if (type === 'origin') {
    if (n < 2) return { ok: false, reason: '추세선은 점이 2개 이상일 때 그려요' }
    const sxx = sum(x.map((v) => v * v))
    if (sxx === 0) return { ok: false, reason: 'x값이 모두 0이라서 추세선을 그릴 수 없어요' }
    // 원점을 지나는 직선의 최소제곱해: a = Σxy / Σx²   (자유롭게 정하는 값이 a 하나뿐이라 자유도는 n-1)
    const a = sum(x.map((v, i) => v * y[i])) / sxx
    const yhat = x.map((v) => a * v)
    const sse = sum(y.map((v, i) => (v - yhat[i]) ** 2))
    return {
      ok: true, type, n, coef: { a }, r2: r2Of(y, yhat), predict: (v) => a * v,
      params: [{ label: '기울기 a', value: a, err: Math.sqrt(sse / (n - 1) / sxx) }],
    }
  }

  if (type === 'quadratic') {
    if (n < 3) return { ok: false, reason: '2차 곡선은 점이 3개 이상 필요해요' }
    if (new Set(x).size < 3) return { ok: false, reason: '2차 곡선은 x값이 서로 다른 점이 3개 이상 필요해요' }
    // 수가 커져도 안정적으로 풀도록 x를 평균 0, 크기 1 안팎으로 바꿔서(w) 푼 뒤 원래 x로 되돌린다.
    const mx = sum(x) / n
    const s = Math.max(...x.map((v) => Math.abs(v - mx)))
    const w = x.map((v) => (v - mx) / s)
    const S = (k) => sum(w.map((v) => v ** k))
    const T = (k) => sum(w.map((v, i) => v ** k * y[i]))
    // 정규방정식: y ≈ A'w² + B'w + C' 의 오차제곱합을 최소로 만드는 A', B', C'
    const sol = solve3([[S(4), S(3), S(2)], [S(3), S(2), S(1)], [S(2), S(1), S(0)]], [T(2), T(1), T(0)])
    if (!sol) return { ok: false, reason: '2차 곡선을 계산할 수 없어요 (점들이 한 직선에 너무 가까워요)' }
    const [A, B, C] = [sol[0] / (s * s), sol[1] / s, sol[2]] // w 에서 u = x - mx 로
    const a = A
    const b = B - 2 * A * mx // u = x - mx 를 풀어서 x 에 대한 계수로
    const c = C - B * mx + A * mx * mx
    const predict = (v) => a * v * v + b * v + c
    return {
      ok: true, type, n, coef: { a, b, c }, r2: r2Of(y, x.map(predict)), predict,
      params: [
        { label: 'a', value: a, err: null },
        { label: 'b', value: b, err: null },
        { label: 'c', value: c, err: null },
      ],
    }
  }

  // 아래 세 유형은 변수를 바꿔서 직선 맞추기로 푼다. 로그를 취하려면 값이 0보다 커야 한다.
  if (type === 'power' || type === 'exponential' || type === 'log') {
    if (type === 'power' && !(x.every((v) => v > 0) && y.every((v) => v > 0))) {
      return { ok: false, reason: '거듭제곱 추세선은 x와 y가 모두 0보다 커야 해요' }
    }
    if (type === 'exponential' && !y.every((v) => v > 0)) {
      return { ok: false, reason: '지수 추세선은 y가 모두 0보다 커야 해요' }
    }
    if (type === 'log' && !x.every((v) => v > 0)) {
      return { ok: false, reason: '로그 추세선은 x가 모두 0보다 커야 해요' }
    }
    const tx = type === 'exponential' ? x : x.map(Math.log) // power, log 는 ln x 로 바꾼다
    const ty = type === 'log' ? y : y.map(Math.log) //         power, exponential 은 ln y 로 바꾼다
    const r = linearFit(tx, ty)
    if (!r.ok) return r
    if (type === 'log') {
      const { slope: a, intercept: b } = r
      return {
        ok: true, type, n, coef: { a, b }, r2: r.r2, predict: (v) => a * Math.log(v) + b,
        params: [
          { label: 'a', value: a, err: r.slopeErr },
          { label: 'b', value: b, err: r.interceptErr },
        ],
      }
    }
    // power, exponential: ln y = (절편) + (기울기)·(바꾼 x)  이므로  a = e^절편,  b = 기울기
    // a 의 오차는 u(a) ≈ a·u(절편) (e^절편 을 미분하면 자기 자신)
    const a = Math.exp(r.intercept)
    const b = r.slope
    const predict = type === 'power' ? (v) => a * v ** b : (v) => a * Math.exp(b * v)
    return {
      ok: true, type, n, coef: { a, b }, r2: r.r2, predict,
      params: [
        { label: 'a', value: a, err: r.interceptErr === null ? null : a * r.interceptErr },
        { label: 'b', value: b, err: r.slopeErr },
      ],
    }
  }

  return { ok: false, reason: '알 수 없는 추세선 유형이에요' }
}

const num4 = (v) => String(Number(v.toPrecision(4)))
const signed = (v) => `${v < 0 ? '−' : '+'} ${num4(Math.abs(v))}`

// 그림 안에 적을 추세선 식. x, y 는 축 이름.
export function equationText(fit, x, y) {
  const c = fit.coef
  switch (fit.type) {
    case 'linear': return `${y} = ${num4(c.a)}·${x} ${signed(c.b)}`
    case 'origin': return `${y} = ${num4(c.a)}·${x}`
    case 'quadratic': return `${y} = ${num4(c.a)}·${x}² ${signed(c.b)}·${x} ${signed(c.c)}`
    case 'power': return `${y} = ${num4(c.a)}·${x}^${num4(c.b)}`
    case 'exponential': return `${y} = ${num4(c.a)}·e^(${num4(c.b)}·${x})`
    case 'log': return `${y} = ${num4(c.a)}·ln(${x}) ${signed(c.b)}`
    default: return ''
  }
}
