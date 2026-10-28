import { linearFit, fitCurve, equationText, FIT_LABELS } from '../src/lib/regression.js'
import { buildGraph, niceTicks, axisDomain } from '../src/lib/graph.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
function close(label, got, want, tol = 1e-9) {
  const good = want === 0 ? Math.abs(got) < 1e-12 : Math.abs(got - want) <= tol * Math.abs(want)
  ok(label, good, `got ${got}, want ${want}`)
}
const measure = (name, rawText, typeB = '', unit = '') => ({ id: name, type: 'measure', name, unit, rawText, typeB })

console.log('\n[1] 직선 추세선 (손으로 검증 가능한 예: y = 2,4,5,4,5)')
{
  const r = linearFit([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])
  ok('성공', r.ok === true)
  close('기울기 0.6', r.slope, 0.6)
  close('절편 2.2', r.intercept, 2.2)
  close('R² = 0.6', r.r2, 0.6)
  // 잔차 -0.8, 0.6, 1.0, -0.6, -0.2 → SSE 2.4, s² = 2.4/3 = 0.8, Sxx = 10
  close('기울기 표준오차 √(0.8/10)', r.slopeErr, Math.sqrt(0.08))
  close('절편 표준오차 √(0.8·(1/5+9/10))', r.interceptErr, Math.sqrt(0.88))
}
{
  const r = linearFit([0, 1, 2, 3], [1, 3, 5, 7])
  close('완전한 직선: 기울기 2', r.slope, 2)
  close('완전한 직선: 절편 1', r.intercept, 1)
  close('완전한 직선: R² = 1', r.r2, 1)
  ok('완전한 직선: 표준오차 0', r.slopeErr < 1e-12 && r.interceptErr < 1e-12)
}
{
  const r = linearFit([1, 2], [3, 5])
  ok('점 2개: 직선은 그려지지만 표준오차는 없음', r.ok && r.slope === 2 && r.slopeErr === null && r.interceptErr === null)
  ok('점 1개 → 실패', linearFit([1], [2]).ok === false)
  ok('x가 모두 같으면 실패', linearFit([2, 2, 2], [1, 2, 3]).ok === false)
  const flat = linearFit([1, 2, 3], [4, 4, 4])
  ok('y가 모두 같으면 기울기 0, R² 는 null', flat.ok && flat.slope === 0 && flat.r2 === null)
}

console.log('\n[2] 눈금')
{
  const t = niceTicks(0, 10)
  ok('0~10 → 0,2,…,10', JSON.stringify(t.ticks) === JSON.stringify([0, 2, 4, 6, 8, 10]), JSON.stringify(t.ticks))
  const u = niceTicks(0.37, 4.9)
  ok('범위를 덮음', u.min <= 0.37 && u.max >= 4.9, JSON.stringify(u))
  const step = u.ticks[1] - u.ticks[0]
  ok('눈금 간격이 일정', u.ticks.every((v, i) => i === 0 || Math.abs(v - u.ticks[i - 1] - step) < 1e-9))
  ok('눈금 개수 적당(≤ 11)', u.ticks.length >= 3 && u.ticks.length <= 11, String(u.ticks.length))
  const s = niceTicks(5, 5)
  ok('값이 하나뿐이어도 범위를 만든다', s.min < 5 && s.max > 5)
  ok('아주 작은 범위(0.001~0.0014)', niceTicks(0.001, 0.0014).ticks.every((v) => v >= 0.0009 && v <= 0.0015))
  const d = axisDomain([{ x: 1, ux: 0.5 }, { x: 3, ux: 0.5 }], 'x', 'ux')
  ok('오차막대 끝(0.5, 3.5)까지 포함', d.min <= 0.5 && d.max >= 3.5)
}

console.log('\n[3] buildGraph')
{
  const L = measure('L', '0.40\n0.60\n0.80\n1.00\n1.20', '0.0005', 'm')
  const T2 = measure('T2', '1.62\n2.40\n3.24\n4.01\n4.85', '0.02', 's²')
  const g = buildGraph({ xName: 'L', yName: 'T2', fit: 'linear' }, [L, T2])
  ok('성공', g.ok, g.message)
  ok('점 5개, 같은 순서끼리 짝', g.points.length === 5 && g.points[0].x === 0.4 && g.points[0].y === 1.62 && g.points[4].y === 4.85)
  ok('오차막대 = B형 불확도', g.points[0].ux === 0.0005 && g.points[0].uy === 0.02 && g.hasXErr && g.hasYErr)
  ok('축 이름에 단위', g.xLabel === 'L (m)' && g.yLabel === 'T2 (s²)')
  ok('추세선 계산됨', g.fit && g.fit.type === 'linear' && g.fit.n === 5 && g.fit.coef.a > 3.9 && g.fit.coef.a < 4.2 && g.fit.r2 > 0.99)
  const none = buildGraph({ xName: 'L', yName: 'T2', fit: 'none' }, [L, T2])
  ok('추세선 없음 선택', none.ok && none.fit === null && none.fitMessage === '')
  const noErr = buildGraph({ xName: 'L', yName: 'T2', fit: 'linear' }, [measure('L', '1\n2\n3'), measure('T2', '2\n4\n6')])
  ok('B형 안 쓰면 오차막대 없음', noErr.ok && !noErr.hasXErr && !noErr.hasYErr && noErr.points[0].ux === 0)
  const uneven = buildGraph({ xName: 'L', yName: 'T2', fit: 'linear' }, [measure('L', '1\n2\n3\n4'), measure('T2', '2\n4\n6')])
  ok('길이가 다르면 짧은 쪽에 맞추고 경고', uneven.ok && uneven.points.length === 3 && uneven.warnings.length === 1)
  const one = buildGraph({ xName: 'L', yName: 'T2', fit: 'linear' }, [measure('L', '1'), measure('T2', '2')])
  ok('점 1개: 그리되 추세선 안내', one.ok && one.fit === null && one.fitMessage.length > 0)
}
{
  const base = [measure('L', '1\n2\n3')]
  ok('축을 안 고름', buildGraph({ xName: '', yName: 'L', fit: 'linear' }, base).empty === true)
  ok('위쪽에 없는 이름', buildGraph({ xName: 'L', yName: 'q', fit: 'linear' }, base).ok === false)
  const withCalc = [measure('L', '1\n2\n3'), { id: 'g', type: 'calc', name: 'g', formula: 'L' }]
  ok('계산 블록은 축으로 못 씀', buildGraph({ xName: 'L', yName: 'g', fit: 'linear' }, withCalc).ok === false)
  ok('측정값 없는 블록', buildGraph({ xName: 'L', yName: 'e', fit: 'linear' }, [...base, measure('e', '')]).ok === false)
  ok('B형 입력 오류', buildGraph({ xName: 'L', yName: 'e', fit: 'linear' }, [...base, measure('e', '1\n2', 'abc')]).ok === false)
  ok('같은 이름이 여럿이면 가까운 위쪽 블록', buildGraph({ xName: 'L', yName: 'L', fit: 'none' }, [measure('L', '1\n2'), measure('L', '5\n6')]).points[0].x === 5)
}


console.log('\n[4] 추세선 유형 (정확히 그 식에서 만든 데이터로 계수가 복원되는지)')
{
  const xs = [1, 2, 3, 4, 5]
  const exact = (label, type, f, want, tol = 1e-9) => {
    const r = fitCurve(type, xs, xs.map(f))
    ok(`${label}: 성공`, r.ok, r.reason)
    if (!r.ok) return
    for (const [k, v] of Object.entries(want)) close(`${label}: 계수 ${k}`, r.coef[k], v, tol)
    close(`${label}: R² = 1`, r.r2, 1, 1e-9)
    close(`${label}: predict(2.5)`, r.predict(2.5), f(2.5), 1e-9)
  }
  exact('직선', 'linear', (x) => 3 * x - 2, { a: 3, b: -2 })
  exact('원점을 지나는 직선', 'origin', (x) => 2 * x, { a: 2 })
  exact('2차 곡선', 'quadratic', (x) => x * x - 2 * x + 3, { a: 1, b: -2, c: 3 })
  exact('거듭제곱', 'power', (x) => 3 * x ** 2, { a: 3, b: 2 })
  exact('지수', 'exponential', (x) => 2 * Math.exp(0.5 * x), { a: 2, b: 0.5 })
  exact('로그', 'log', (x) => 2 * Math.log(x) + 1, { a: 2, b: 1 })

  // 손으로 구한 값: x=[1,2,3], y=[2,4,7] → a = 31/14, SSE = 0.357143, SST = 12.6667
  const o = fitCurve('origin', [1, 2, 3], [2, 4, 7])
  close('원점 직선 a = 31/14', o.coef.a, 31 / 14)
  close('원점 직선 R² = 1 - SSE/SST', o.r2, 1 - 0.3571428571428571 / 12.666666666666666, 1e-9)
  close('원점 직선 표준오차 √(SSE/(n-1)/Σx²)', o.params[0].err, Math.sqrt(0.3571428571428571 / 2 / 14), 1e-9)
  // 2차 곡선: 점이 3개면 3점을 정확히 지난다
  const q3 = fitCurve('quadratic', [0, 1, 2], [1, 0, 3])
  ok('2차 곡선 점 3개 → 모든 점을 지남', [0, 1, 2].every((x, i) => Math.abs(q3.predict(x) - [1, 0, 3][i]) < 1e-9))
  // 큰 수에서도 안정적인지 (x가 1000대)
  const big = fitCurve('quadratic', [1000, 1001, 1002, 1003], [5, 6, 9, 14]) // y = (x-1000)² + 5
  close('2차 곡선 큰 x 값도 안정적 (x=1001.5 에서 7.25)', big.predict(1001.5), 7.25, 1e-6)
  ok('2차 곡선 큰 x: R² = 1', big.ok && big.r2 > 0.999999)
  // 변환 유형의 표준오차: 거듭제곱 b의 오차 = ln-ln 직선의 기울기 오차
  const noisy = fitCurve('power', [1, 2, 3, 4, 5], [3.1, 11.8, 27.5, 47.9, 76.0])
  const ll = linearFit([1, 2, 3, 4, 5].map(Math.log), [3.1, 11.8, 27.5, 47.9, 76.0].map(Math.log))
  close('거듭제곱 b 표준오차 = ln-ln 직선 기울기 오차', noisy.params[1].err, ll.slopeErr)
  close('거듭제곱 a 표준오차 ≈ a·u(절편)', noisy.params[0].err, Math.exp(ll.intercept) * ll.interceptErr)

  // 계산할 수 없는 경우
  ok('거듭제곱: x가 0 이하면 실패', fitCurve('power', [0, 1, 2], [1, 2, 3]).ok === false)
  ok('거듭제곱: y가 0 이하면 실패', fitCurve('power', [1, 2, 3], [1, -2, 3]).ok === false)
  ok('지수: y가 0 이하면 실패(x는 0 가능)', fitCurve('exponential', [0, 1, 2], [1, 0, 3]).ok === false && fitCurve('exponential', [0, 1, 2], [1, 2, 3]).ok)
  ok('로그: x가 0 이하면 실패(y는 음수 가능)', fitCurve('log', [0, 1, 2], [1, 2, 3]).ok === false && fitCurve('log', [1, 2, 3], [-1, 2, 3]).ok)
  ok('2차: 점 2개면 실패', fitCurve('quadratic', [1, 2], [1, 2]).ok === false)
  ok('2차: x가 서로 다른 값 2종류뿐이면 실패', fitCurve('quadratic', [1, 1, 2, 2], [1, 2, 3, 4]).ok === false)
  ok('원점 직선: 점 1개면 실패', fitCurve('origin', [1], [1]).ok === false)
  ok('모르는 유형', fitCurve('spline', xs, xs).ok === false)

  // 식 글자
  const eq = (type, f) => equationText(fitCurve(type, xs, xs.map(f)), 'x', 'y')
  ok('식: 직선', eq('linear', (x) => 3 * x - 2) === 'y = 3·x − 2', eq('linear', (x) => 3 * x - 2))
  ok('식: 원점', eq('origin', (x) => 2 * x) === 'y = 2·x')
  ok('식: 2차(부호)', eq('quadratic', (x) => x * x - 2 * x + 3) === 'y = 1·x² − 2·x + 3', eq('quadratic', (x) => x * x - 2 * x + 3))
  ok('식: 거듭제곱', eq('power', (x) => 3 * x ** 2) === 'y = 3·x^2')
  ok('식: 지수', eq('exponential', (x) => 2 * Math.exp(0.5 * x)) === 'y = 2·e^(0.5·x)')
  ok('식: 로그', eq('log', (x) => 2 * Math.log(x) + 1) === 'y = 2·ln(x) + 1')
  ok('유형 이름 목록에 모두 있음', ['linear', 'origin', 'quadratic', 'power', 'exponential', 'log', 'none'].every((k) => FIT_LABELS[k]))

  // buildGraph 에서도 유형이 전달된다
  const L = measure('L', '1\n2\n3\n4\n5')
  const Y = measure('Y', '3\n12\n27\n48\n75')
  const bg = buildGraph({ xName: 'L', yName: 'Y', fit: 'power' }, [L, Y])
  ok('buildGraph: 거듭제곱 유형', bg.ok && bg.fit.type === 'power' && Math.abs(bg.fit.coef.b - 2) < 1e-9)
  const bad = buildGraph({ xName: 'L', yName: 'Y', fit: 'log' }, [measure('L', '0\n1\n2'), measure('Y', '1\n2\n3')])
  ok('buildGraph: 못 그리는 유형은 점은 그리고 안내만', bad.ok && bad.fit === null && bad.fitMessage.length > 0)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
