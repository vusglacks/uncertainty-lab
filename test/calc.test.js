import { evaluateCalc } from '../src/lib/calc.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
function close(label, got, want, tol = 1e-9) {
  const good = want === 0 ? Math.abs(got) < 1e-12 : Math.abs(got - want) <= tol * Math.abs(want)
  ok(label, good, `got ${got}, want ${want}`)
}

// 테스트용 측정 블록
const measure = (name, rawText, typeB = '') => ({ id: name, type: 'measure', name, unit: '', rawText, typeB })

// 손으로 계산하는 기대값 (stats.js 를 쓰지 않고 따로 계산해서 서로 검증)
function manual(values, uB) {
  const n = values.length
  const m = values.reduce((s, x) => s + x, 0) / n
  const s = Math.sqrt(values.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1))
  return { m, u: Math.sqrt((s / Math.sqrt(n)) ** 2 + uB ** 2) }
}

console.log('\n[1] 단진자 g = 4π²L/T²  (측정 블록 평균·합성불확도 → 오차 전파)')
{
  const Lv = [1.001, 0.998, 1.002, 1.0]
  const Tv = [2.006, 2.004, 2.008]
  const blocks = [
    measure('L', '1.001\n0.998\r\n1.002\n1.000', '0.0005'),
    measure('T', '2.006\t2.004\t2.008', '0.001'), // 탭으로 구분
  ]
  const L = manual(Lv, 0.0005), T = manual(Tv, 0.001)
  const dL = (4 * Math.PI ** 2) / T.m ** 2
  const dT = (-8 * Math.PI ** 2 * L.m) / T.m ** 3
  const uc = Math.sqrt((dL * L.u) ** 2 + (dT * T.u) ** 2)

  const r = evaluateCalc('4*pi^2*L / T^2', blocks, 'deg')
  ok('성공', r.ok === true, r.message)
  close('값 (평균으로 계산)', r.value, (4 * Math.PI ** 2 * L.m) / T.m ** 2)
  close('불확도 (합성불확도를 전파)', r.uncertainty, uc)
  close('기여도 합 = 100%', r.terms.reduce((s, t) => s + t.share, 0), 100, 1e-9)
  close('L 기여도', r.terms.find((t) => t.name === 'L').share, ((dL * L.u) ** 2 / uc ** 2) * 100)
  ok('기여도 큰 순서로 정렬', r.terms[0].share >= r.terms[1].share)
  ok('유효숫자 처리된 문자열', /^\d+\.\d+ ± \d+\.\d+$/.test(r.text), r.text)
}

console.log('\n[2] 같은 이름이 여러 개면 가장 가까운 위쪽 블록')
{
  const blocks = [measure('x', '1\n1\n1', '0.1'), measure('x', '2\n2\n2', '0.1')]
  const r = evaluateCalc('x', blocks, 'rad')
  close('아래쪽 x(=2)를 사용', r.value, 2)
}

console.log('\n[3] 삼각함수 각도 단위')
{
  const blocks = [measure('a', '30\n30\n30', '1')] // 평균 30, 표준편차 0 → uc = uB = 1
  const deg = evaluateCalc('sin(a)', blocks, 'deg')
  close('도: sin(30°) = 0.5', deg.value, 0.5, 1e-12)
  close('도: u = cos(30°)·(1° → rad)', deg.uncertainty, Math.cos(Math.PI / 6) * (Math.PI / 180), 1e-12)
  const rad = evaluateCalc('sin(a)', [measure('a', '0.5\n0.5', '0.01')], 'rad')
  close('라디안: sin(0.5)', rad.value, Math.sin(0.5))
  close('라디안: u = cos(0.5)·0.01', rad.uncertainty, Math.cos(0.5) * 0.01)
}

console.log('\n[4] 오류와 빈 수식')
{
  const base = [measure('L', '1\n2\n3')]
  ok('빈 수식', evaluateCalc('  ', base, 'deg').empty === true)
  ok('위에 없는 이름', evaluateCalc('q*2', base, 'deg').ok === false)
  ok('문법 오류(덜 쓴 수식)', evaluateCalc('L / ', base, 'deg').ok === false)
  ok('모르는 함수', evaluateCalc('foo(L)', base, 'deg').ok === false)
  ok('0으로 나누기', evaluateCalc('1/(L-L)', base, 'deg').ok === false)
  ok('측정값 없는 블록', evaluateCalc('L', [measure('L', '')], 'deg').ok === false)
  ok('불확도 정보 없음(값 1개, B형 없음)', evaluateCalc('L', [measure('L', '5')], 'deg').ok === false)
  ok('B형 입력 오류', evaluateCalc('L', [measure('L', '1\n2', 'abc')], 'deg').ok === false)
  const withCalc = [measure('L', '1\n2\n3'), { id: 'g', type: 'calc', name: 'g', formula: 'L' }]
  ok('계산 블록 이름은 수식에 못 씀', evaluateCalc('g*2', withCalc, 'deg').ok === false)
  const c = evaluateCalc('2^3^2', [], 'deg')
  ok('변수 없는 수식도 계산 (2^3^2 = 512)', c.ok && c.value === 512 && c.terms.length === 0)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
