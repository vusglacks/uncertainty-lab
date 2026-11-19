import { compileFormula } from '../src/lib/expand.js'
import { evaluateCalc, evaluateRows } from '../src/lib/calc.js'
import { buildGraph } from '../src/lib/graph.js'
import { buildReport } from '../src/lib/report.js'

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
const calc = (name, formula) => ({ id: name, type: 'calc', name, formula })

// 손으로 계산하는 기대값 (stats.js·calc.js 를 쓰지 않고 따로 계산)
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const sd = (a) => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1))
const uc = (a, uB) => Math.sqrt((sd(a) / Math.sqrt(a.length)) ** 2 + uB ** 2) // 합성표준불확도

console.log('\n[1] 펼치기: 계산 블록 이름을 그 식으로')
{
  const blocks = [measure('T', '1\n2\n3', '0.1'), calc('T2', 'T^2')]
  const c = compileFormula('T2 / T', blocks)
  ok('성공', c.ok, c.message)
  ok('펼친 식에 계산 블록 이름이 남지 않는다', c.ok && !c.expr.includes('T2'), c.expr)
  ok('측정 블록 변수는 하나로 합쳐진다 (T 를 두 경로로 써도)', c.ok && c.vars.length === 1 && c.vars[0].name === 'T')
  ok('사람이 읽는 식', c.text === '((T ^ 2) / T)', c.text)
  ok('계산 블록이 덩어리 하나로 들어가 연산 순서가 안 깨진다 (A*B 에서 B=x+1)', compileFormula('B * 2', [measure('x', '1\n2'), calc('B', 'x + 1')]).text === '((x + 1) * 2)', compileFormula('B * 2', [measure('x', '1\n2'), calc('B', 'x + 1')]).text)
  ok('펼친 계산 블록 목록', c.usedCalcs.length === 1 && c.usedCalcs[0] === 'T2')
  ok('펼칠 것이 없으면 usedCalcs 가 비어 있다', compileFormula('T*2', blocks).usedCalcs.length === 0)
  const deep = compileFormula('B', [measure('x', '1\n2'), calc('A', 'x+1'), calc('B', 'A*A')])
  ok('두 단계 펼치기', deep.ok && deep.vars.length === 1, deep.message)
  ok('pi 와 e 는 이름 그대로', compileFormula('pi*e', []).expr === '(pi * e)', compileFormula('pi*e', []).expr)
}

console.log('\n[2] 값 하나: 계산 블록 결과를 다른 식에서 쓰기 (불확도까지 전파)')
{
  const Tv = [2.006, 2.004, 2.008, 2.005, 2.007], Lv = [1.001, 0.998, 1.002, 0.999, 1.0]
  const T = measure('T', Tv.join('\n'), '0.001'), L = measure('L', Lv.join('\n'), '0.0005')
  const direct = evaluateCalc('4*pi^2*L / T^2', [L, T], 'deg')
  const chained = evaluateCalc('4*pi^2*L / T2', [L, T, calc('T2', 'T^2')], 'deg')
  ok('성공', chained.ok, chained.message)
  close('T2 를 거쳐도 값이 같다', chained.value, direct.value, 1e-12)
  close('T2 를 거쳐도 불확도가 같다', chained.uncertainty, direct.uncertainty, 1e-12)
  ok('기여도는 측정 블록(T, L)별로 나온다', chained.terms.length === 2 && chained.terms.map((t) => t.name).sort().join() === 'L,T')
  close('기여도 T', chained.terms.find((t) => t.name === 'T').share, direct.terms.find((t) => t.name === 'T').share, 1e-9)
  ok('펼친 식을 알려준다', typeof chained.expanded === 'string' && chained.expanded.includes('T'), String(chained.expanded))
  ok('펼칠 게 없으면 expanded 는 null', direct.expanded === null)
}
{
  // 같은 T 에서 나온 두 양은 독립이 아니다: B = T2 / T = T 이므로 u(B) = u(T) 여야 한다.
  const Tv = [10, 12, 11, 13]
  const T = measure('T', Tv.join('\n'), '0.5')
  const r = evaluateCalc('T2 / T', [T, calc('T2', 'T^2')], 'rad')
  close('상관관계: u(T²/T) = u(T)', r.uncertainty, uc(Tv, 0.5), 1e-12)
  close('값: 평균 T', r.value, mean(Tv), 1e-12)
  // 독립이라고 잘못 가정했다면 나왔을 값(더 크다)과 다르다는 것도 확인
  const m = mean(Tv), u = uc(Tv, 0.5)
  const wrong = Math.sqrt((u * 2 * m / m) ** 2 + (m * m / m / m * u) ** 2)
  ok('독립 가정(틀린 값)과는 다르다', Math.abs(r.uncertainty - wrong) > 1e-6 * wrong, `${r.uncertainty} vs ${wrong}`)
}
{
  // 이름 해석은 "그 블록의 위치"를 기준으로: 같은 이름 L 이 두 개여도 섞이지 않는다
  const blocks = [measure('L', '1\n1\n1', '0.1'), calc('c', 'L*2'), measure('L', '10\n10\n10', '0.1')]
  const r = evaluateCalc('c + L', blocks, 'rad')
  close('c 안의 L 은 위쪽 L(=1), 바깥 L 은 가까운 L(=10): 2 + 10', r.value, 12, 1e-12)
  ok('서로 다른 두 변수로 취급', r.terms.length === 2)
  close('독립이라 u = √(0.2² + 0.1²)', r.uncertainty, Math.sqrt(0.2 ** 2 + 0.1 ** 2), 1e-12)
}
{
  // 도 단위: 계산 블록을 거쳐도 삼각함수 안의 변수는 라디안으로 바뀐다. B = A² (A = sin(a)), a = 30°±1°
  const a = measure('a', '30\n30\n30', '1')
  const r = evaluateCalc('A*A', [a, calc('A', 'sin(a)')], 'deg')
  close('sin²(30°) = 0.25', r.value, 0.25, 1e-12)
  const rad = Math.PI / 180
  close('u = 2·sin·cos·u(a[rad])', r.uncertainty, 2 * Math.sin(30 * rad) * Math.cos(30 * rad) * (1 * rad), 1e-12)
}

console.log('\n[3] 오류 안내')
{
  const base = [measure('L', '1\n2\n3', '0.1')]
  ok('위쪽에 없는 이름', evaluateCalc('q*2', base, 'deg').ok === false)
  ok('아래쪽(뒤)에 있는 계산 블록은 못 씀', evaluateCalc('later*2', [...base], 'deg').ok === false)
  const bad = evaluateCalc('x*2', [...base, calc('x', 'zzz+1')], 'deg')
  ok('안쪽 계산 블록의 오류는 어느 블록인지 알려준다', !bad.ok && bad.message.includes("'x' 계산 블록") && bad.message.includes('zzz'), bad.message)
  ok('수식이 빈 계산 블록', evaluateCalc('x*2', [...base, calc('x', '')], 'deg').ok === false)
  ok('문법이 깨진 계산 블록', evaluateCalc('x*2', [...base, calc('x', 'L / ')], 'deg').ok === false)
  ok('안쪽 블록이 불확도 정보 없음(값 1개, B형 없음)', evaluateCalc('x', [measure('L', '5'), calc('x', 'L')], 'deg').ok === false)
}

console.log('\n[4] 행별 값 (그래프 축용)')
{
  const Tv = [1.27, 1.55, 1.79, 2.01]
  const T = measure('T', Tv.join('\n'), '0.01')
  const r = evaluateRows('T^2', [T], 'deg')
  ok('성공, 행 4개', r.ok && r.rows.length === 4, r.message)
  close('1행 값 = T₁²', r.rows[0].value, 1.27 ** 2, 1e-12)
  close('4행 값 = T₄²', r.rows[3].value, 2.01 ** 2, 1e-12)
  close('행 불확도 = 2·T·u(B형)', r.rows[1].u, 2 * 1.55 * 0.01, 1e-12)
  ok('경고·안내 없음', r.warnings.length === 0 && r.notes.length === 0)
  const noB = evaluateRows('T^2', [measure('T', '1\n2\n3')], 'deg')
  ok('B형을 안 쓰면 행 불확도는 0', noB.ok && noB.rows.every((x) => x.u === 0))
  const two = evaluateRows('L / T', [measure('L', '2\n4\n6', '0.1'), measure('T', '1\n2\n3', '0.2')], 'deg')
  close('두 블록: 3행째 값 6/3', two.rows[2].value, 2, 1e-12)
  close('두 블록: 3행째 불확도 √((0.1/3)² + (6·0.2/9)²)', two.rows[2].u, Math.sqrt((0.1 / 3) ** 2 + (6 * 0.2 / 9) ** 2), 1e-12)
}
{
  const mism = evaluateRows('L + T', [measure('L', '1\n2\n3\n4\n5'), measure('T', '10\n20\n30\n40')], 'deg')
  ok('행 개수가 다르면 가장 적은 쪽에 맞춘다 (4행)', mism.ok && mism.rows.length === 4)
  ok('행 개수가 다르면 경고한다', mism.warnings.length === 1 && mism.warnings[0].includes('L 5개') && mism.warnings[0].includes('T 4개'), JSON.stringify(mism.warnings))
  close('앞에서부터 짝짓는다: 4행 = 4 + 40', mism.rows[3].value, 44, 1e-12)
  const same = evaluateRows('L + T', [measure('L', '1\n2\n3'), measure('T', '4\n5\n6')], 'deg')
  ok('개수가 같으면 경고 없음', same.warnings.length === 0)
  const withConst = evaluateRows('L * k', [measure('L', '1\n2\n3', '0.1'), measure('k', '10', '0.5')], 'deg')
  ok('값이 1개인 블록은 상수: 모든 행에 사용', withConst.ok && withConst.rows.length === 3 && withConst.rows[2].value === 30, JSON.stringify(withConst))
  ok('상수 안내는 경고가 아니라 notes', withConst.warnings.length === 0 && withConst.notes.length === 1)
  close('상수의 불확도도 전파: √((10·0.1)² + (3·0.5)²)', withConst.rows[2].u, Math.sqrt(1 + 2.25), 1e-12)
  const none = evaluateRows('pi*2', [], 'deg')
  ok('변수가 없으면 1행', none.ok && none.rows.length === 1)
  ok('계산 블록을 거쳐도 행별로 계산', (() => { const q = evaluateRows('A + 1', [measure('x', '1\n2\n3', '0.1'), calc('A', 'x*x')], 'deg'); return q.ok && q.rows.length === 3 && q.rows[2].value === 10 })())
}
{
  ok('행 계산 실패는 몇 번째 행인지 알려준다', (() => { const q = evaluateRows('1/(x-2)', [measure('x', '1\n2\n3')], 'deg'); return !q.ok && q.message.includes('2번째 행') })(), '')
  ok('ln 에 음수가 들어간 행', (() => { const q = evaluateRows('ln(x)', [measure('x', '5\n-1\n3')], 'deg'); return !q.ok && q.message.includes('2번째 행') })(), '')
  ok('수식이 비면 empty', evaluateRows('  ', [], 'deg').empty === true)
}

console.log('\n[5] 그래프: 계산 블록을 축으로 (T 측정 → T² 계산 → x축)')
{
  // 길이 L 을 바꿔 가며 잰 주기 T. 이론상 T² = (4π²/g)·L 이라서 x=T², y=L 은 직선
  const g = 9.81
  const Lv = [0.4, 0.6, 0.8, 1.0, 1.2]
  const Tv = Lv.map((l) => 2 * Math.PI * Math.sqrt(l / g))
  const T = measure('T', Tv.map((t) => t.toFixed(4)).join('\n'), '0.005', 's')
  const L = measure('L', Lv.join('\n'), '0.01', 'm')
  const blocks = [T, calc('T2', 'T^2'), L]
  const m = buildGraph({ xName: 'T2', yName: 'L', fit: 'linear' }, blocks, 'deg')
  ok('성공', m.ok, m.message)
  ok('점 5개', m.ok && m.points.length === 5)
  close('1번째 점 x = T₁²', m.points[0].x, Number(Tv[0].toFixed(4)) ** 2, 1e-12)
  close('1번째 점 y = L₁', m.points[0].y, 0.4, 1e-12)
  close('x 오차막대는 점마다 다르다: 2·T·0.005', m.points[4].ux, 2 * Number(Tv[4].toFixed(4)) * 0.005, 1e-12)
  ok('점마다 x 오차막대가 다른 값', m.points[0].ux !== m.points[4].ux)
  close('y 오차막대는 B형 그대로', m.points[2].uy, 0.01, 1e-12)
  ok('오차막대 표시 여부', m.hasXErr && m.hasYErr)
  ok('축 이름: 계산 블록 축에는 결과 단위가 붙는다', m.xLabel === 'T2 (s²)' && m.yLabel === 'L (m)', `${m.xLabel} / ${m.yLabel}`)
  ok('직선 추세선', m.fit && m.fit.type === 'linear' && m.fit.r2 > 0.9999, JSON.stringify(m.fit && m.fit.r2))
  close('기울기 L/T² = g/(4π²)', m.fit.coef.a, g / (4 * Math.PI ** 2), 1e-3)
  // 반대로 y 축에 계산 블록
  const my = buildGraph({ xName: 'L', yName: 'T2', fit: 'none' }, blocks, 'deg')
  ok('y축에도 계산 블록', my.ok && my.points[0].y === m.points[0].x)
  // 경고·오류
  const bad = buildGraph({ xName: 'T2', yName: 'L', fit: 'none' }, [T, calc('T2', 'T^2'), measure('L', '1\n2\n3')], 'deg')
  ok('개수가 다르면 앞에서부터 짝짓고 경고', bad.ok && bad.points.length === 3 && bad.warnings.length === 1)
  const mix = buildGraph({ xName: 'S', yName: 'L', fit: 'none' }, [measure('A', '1\n2\n3'), measure('B', '1\n2'), calc('S', 'A + B'), measure('L', '1\n2')], 'deg')
  ok('계산 블록 안의 행 개수 경고도 그래프에 전달', mix.ok && mix.warnings.some((w) => w.startsWith('S:') && w.includes('행 개수가 달라요')), JSON.stringify(mix.warnings))
  ok('수식이 빈 계산 블록을 축으로 고르면 안내', buildGraph({ xName: 'E', yName: 'L', fit: 'none' }, [calc('E', ''), measure('L', '1\n2')], 'deg').ok === false)
  ok('계산 실패는 축 이름과 이유를 알려준다', (() => { const q = buildGraph({ xName: 'E', yName: 'L', fit: 'none' }, [measure('x', '1\n2'), calc('E', '1/(x-1)'), measure('L', '1\n2')], 'deg'); return !q.ok && q.message.includes("x축 'E'") && q.message.includes('1번째 행') })(), '')
  // 도 단위가 그래프 축 계산에도 적용된다
  const deg = buildGraph({ xName: 'S', yName: 'L', fit: 'none' }, [measure('a', '30\n90', '1'), calc('S', 'sin(a)'), measure('L', '1\n2')], 'deg')
  close('도 단위: sin(30°)', deg.points[0].x, 0.5, 1e-12)
  close('도 단위: sin(90°)', deg.points[1].x, 1, 1e-12)
}

console.log('\n[6] 내보내기 표도 계산 블록 연결을 반영')
{
  const blocks = [measure('L', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005'), measure('T', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001'), calc('T2', 'T^2'), calc('g', '4*pi^2*L / T2')]
  const r = buildReport(blocks, 'deg')
  ok('계산 표: 계산 블록 2개 줄', r.calc.length === 3)
  ok('T2 줄: 값이 나온다', /^\d/.test(r.calc[1][2]) && !r.calc[1][2].startsWith('계산할 수 없음'), r.calc[1][2])
  ok('g = 9.811 ± 0.015 (T2 를 거쳐도 같다)', r.calc[2][2] === '9.811 ± 0.015', r.calc[2][2])
  ok('기여도는 측정 블록별', r.calc[2][3] === 'T 66.5%, L 33.5%', r.calc[2][3])
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
