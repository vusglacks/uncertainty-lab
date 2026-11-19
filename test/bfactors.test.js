import { parseBFactors, measureStats, B_KINDS } from '../src/lib/stats.js'
import { evaluateCalc } from '../src/lib/calc.js'
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
const F = (kind, value, k, label = '') => ({ id: `${kind}${value}`, label, kind, value, k })
const block = (extra = {}) => ({ id: 'x', type: 'measure', name: 'x', unit: '', rawText: '1.0\n2.0\n3.0', typeB: '', ...extra })

console.log('\n[1] 요인 하나의 표준불확도 (손계산)')
{
  const one = (f) => parseBFactors([f]).u
  close('분해능 δ=0.01 → 0.01/(2√3) = 0.0028868', one(F('resolution', '0.01')), 0.01 / (2 * Math.sqrt(3)))
  close('분해능 δ=0.01 의 값 0.002887 (손계산 소수 8자리)', one(F('resolution', '0.01')), 0.0028867513, 1e-7)
  close('직사각형 ±0.05 → 0.05/√3 = 0.028868', one(F('rect', '0.05')), 0.0288675135, 1e-8)
  close('삼각 ±0.05 → 0.05/√6 = 0.020412', one(F('tri', '0.05')), 0.0204124145, 1e-8)
  close('확장불확도 U=0.1, k=2 → 0.05', one(F('ext', '0.1', '2')), 0.05)
  close('확장불확도 k 를 비우면 기본 2', one(F('ext', '0.1', '')), 0.05)
  close('확장불확도 U=0.3, k=3 → 0.1', one(F('ext', '0.3', '3')), 0.1)
  close('표준불확도 직접 0.002', one(F('std', '0.002')), 0.002)
  close('값 0 은 0 (쓴 것으로 본다)', one(F('rect', '0')), 0)
  ok('값 0 도 "입력함"', parseBFactors([F('rect', '0')]).given === true)
  ok('종류 목록은 5개이고 모두 변환식이 있다', B_KINDS.length === 5 && B_KINDS.every((k) => k.formula && k.convert(1, 2) > 0))
}

console.log('\n[2] 여러 요인 합성: u_B = √(Σu²)')
{
  const r = parseBFactors([F('resolution', '0.01'), F('rect', '0.05')])
  const want = Math.sqrt((0.01 / (2 * Math.sqrt(3))) ** 2 + (0.05 / Math.sqrt(3)) ** 2)
  close('분해능 + 기기오차 합성', r.u, want)
  close('= 0.029012 (손계산)', r.u, 0.0290115, 1e-4)
  ok('요인별 u 목록', r.list.length === 2 && r.list.every((x) => x.used && x.u > 0))
  const three = parseBFactors([F('std', '0.003'), F('std', '0.004'), F('std', '0')])
  close('0.003 와 0.004 → 0.005 (3-4-5)', three.u, 0.005)
  ok('빈 목록·없음·undefined', parseBFactors([]).u === 0 && parseBFactors(undefined).u === 0 && parseBFactors(null).given === false)
}

console.log('\n[3] 잘못된 입력과 빈 줄')
{
  const empty = parseBFactors([F('rect', ''), F('rect', '  '), F('resolution', '0.01')])
  ok('값이 빈 줄은 건너뛴다', empty.error === null && empty.list.filter((x) => x.used).length === 1)
  close('빈 줄을 건너뛰고 나머지만 합성', empty.u, 0.01 / (2 * Math.sqrt(3)))
  const bad = parseBFactors([F('rect', 'abc', '', '기기')])
  ok('숫자가 아니면 어느 요인인지 알려준다', bad.error !== null && bad.error.includes("'기기'"), String(bad.error))
  ok('음수는 오류', parseBFactors([F('rect', '-1')]).error !== null)
  ok('k = 0 은 오류', parseBFactors([F('ext', '0.1', '0')]).error !== null)
  ok('k 가 숫자가 아니면 오류', parseBFactors([F('ext', '0.1', 'x')]).error !== null)
  ok('k 는 U 가 비었을 때는 검사하지 않는다', parseBFactors([F('ext', '', 'x')]).error === null)
  ok('모르는 종류는 오류', parseBFactors([F('magic', '1')]).error !== null)
  ok('요인 이름이 없으면 종류 이름으로 안내', parseBFactors([F('resolution', 'q')]).error.includes('분해능'))
}

console.log('\n[3b] 값이 0.0005 처럼 소수·지수 표기여도 된다')
{
  close('1e-3 표기', parseBFactors([F('std', '1e-3')]).u, 0.001)
  close('.5 표기', parseBFactors([F('std', '.5')]).u, 0.5)
}

console.log('\n[4] 측정 블록: 직접 입력 B형 + 요인 + A형')
{
  // 값 1, 2, 3: 평균 2, 표본표준편차 1, u_A = 1/√3
  const uA = 1 / Math.sqrt(3)
  const f = [F('resolution', '0.01'), F('rect', '0.05')]
  const uBf = Math.sqrt((0.01 / (2 * Math.sqrt(3))) ** 2 + (0.05 / Math.sqrt(3)) ** 2)
  const s1 = measureStats(block({ bFactors: f }))
  close('요인만: u_B', s1.uB, uBf)
  close('요인만: u_c = √(u_A² + u_B²)', s1.uC, Math.sqrt(uA ** 2 + uBf ** 2))
  ok('B형을 입력한 것으로 본다', s1.uBGiven === true && s1.typeBError === null && s1.bDirect === null)
  const s2 = measureStats(block({ typeB: '0.001', bFactors: f }))
  close('직접 입력 + 요인: u_B = √(0.001² + Σu²)', s2.uB, Math.sqrt(0.001 ** 2 + uBf ** 2))
  close('직접 입력 + 요인: u_c', s2.uC, Math.sqrt(uA ** 2 + 0.001 ** 2 + uBf ** 2))
  ok('직접 입력한 값 따로 보관', s2.bDirect === 0.001)
  // 호환: 예전 블록(요인 필드 없음, undefined)과 새 블록(빈 배열)이 같은 결과
  const old = measureStats({ id: 'o', type: 'measure', name: 'o', unit: '', rawText: '1\n2\n3', typeB: '0.1' })
  const nw = measureStats(block({ typeB: '0.1', bFactors: [] }))
  ok('예전 저장본(bFactors 없음)도 그대로 계산', old.uB === 0.1 && nw.uB === 0.1 && old.uC === nw.uC && old.bFactors.length === 0)
  close('예전 저장본 u_c = √(u_A² + 0.1²)', old.uC, Math.sqrt(uA ** 2 + 0.01))
  const err = measureStats(block({ bFactors: [F('rect', 'abc')] }))
  ok('요인 오류가 블록 오류로 전해지고 u_c 는 계산 안 함', err.typeBError !== null && err.uC === null)
  const err2 = measureStats(block({ typeB: 'zzz', bFactors: [F('rect', '0.1')] }))
  ok('직접 입력 오류도 그대로', err2.typeBError !== null && err2.uC === null)
  const single = measureStats(block({ rawText: '5', bFactors: [F('std', '0.02')] }))
  ok('값 1개 + 요인만 있어도 u_c = u_B', single.uA === null && Math.abs(single.uC - 0.02) < 1e-12)
  const none = measureStats(block({ rawText: '5', bFactors: [F('rect', '')] }))
  ok('값 1개 + 빈 요인만 → 불확도 정보 없음', none.uC === null && none.uBGiven === false)
}

console.log('\n[5] 계산·그래프·내보내기가 합성된 B형을 쓴다')
{
  const Tv = '2.006\n2.004\n2.008\n2.005\n2.007', Lv = '1.001\n0.998\n1.002\n0.999\n1.000'
  // 같은 u_B(=0.001) 를 "직접 입력"과 "표준불확도 요인"으로 넣으면 결과가 같아야 한다
  const A = [block({ name: 'T', rawText: Tv, typeB: '0.001' }), block({ id: 'L', name: 'L', rawText: Lv, typeB: '0.0005' })]
  const B = [block({ name: 'T', rawText: Tv, bFactors: [F('std', '0.001')] }), block({ id: 'L', name: 'L', rawText: Lv, bFactors: [F('std', '0.0005')] })]
  const ra = evaluateCalc('4*pi^2*L / T^2', [A[1], A[0]], 'deg'), rb = evaluateCalc('4*pi^2*L / T^2', [B[1], B[0]], 'deg')
  close('계산 블록: 직접 입력과 요인 입력이 같은 불확도', rb.uncertainty, ra.uncertainty, 1e-12)
  // 분해능으로 넣으면 더 작아진다: δ=0.002 → u = 0.002/(2√3) = 0.000577
  const C = [block({ name: 'T', rawText: Tv, bFactors: [F('resolution', '0.002')] }), B[1]]
  const rc = evaluateCalc('4*pi^2*L / T^2', [C[1], C[0]], 'deg')
  ok('분해능 0.002 (u = 0.000577) 는 u = 0.001 보다 불확도가 작다', rc.uncertainty < rb.uncertainty)
  const g = buildGraph({ xName: 'T', yName: 'L', fit: 'none' }, [C[0], C[1]], 'deg')
  close('그래프 오차막대 = 합성된 B형', g.points[0].ux, 0.002 / (2 * Math.sqrt(3)), 1e-12)
  const rep = buildReport([C[0], C[1]], 'deg')
  ok('내보내기 표의 u_B 열', rep.measure[1][6] === String(Number((0.002 / (2 * Math.sqrt(3))).toPrecision(6))), rep.measure[1][6])
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
