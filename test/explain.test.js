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
const measure = (name, rawText, typeB = '', unit = '') => ({ id: name, type: 'measure', name, unit, rawText, typeB })
const calc = (name, formula) => ({ id: name, type: 'calc', name, formula })

// 손으로 계산하는 값 (앱 코드를 쓰지 않음)
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const sd = (a) => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1))
const uc = (a, uB) => Math.sqrt((sd(a) / Math.sqrt(a.length)) ** 2 + uB ** 2)

console.log('\n[1] 단진자 g = 4π²L/T² 의 계산 과정')
{
  const Lv = [1.001, 0.998, 1.002, 0.999, 1.0], Tv = [2.006, 2.004, 2.008, 2.005, 2.007]
  const r = evaluateCalc('4*pi^2*L / T^2', [measure('L', Lv.join('\n'), '0.0005'), measure('T', Tv.join('\n'), '0.001')], 'deg')
  ok('성공하고 explain 이 있다', r.ok && r.explain && r.explain.rows.length === 2, r.message)
  const E = r.explain
  const Lm = mean(Lv), Tm = mean(Tv), uL = uc(Lv, 0.0005), uT = uc(Tv, 0.001)
  const dL = (4 * Math.PI ** 2) / Tm ** 2 // ∂g/∂L = 4π²/T²
  const dT = (-8 * Math.PI ** 2 * Lm) / Tm ** 3 // ∂g/∂T = -8π²L/T³
  const rowL = E.rows.find((x) => x.name === 'L'), rowT = E.rows.find((x) => x.name === 'T')
  close('L: 값(평균)', rowL.x, Lm, 1e-12)
  close('L: 불확도(합성)', rowL.u, uL, 1e-12)
  close('L: 편미분 값 4π²/T²', rowL.partial, dL, 1e-9)
  close('T: 편미분 값 -8π²L/T³', rowT.partial, dT, 1e-9)
  close('L: 항 = 편미분 × u', rowL.term, dL * uL, 1e-9)
  close('T: 항 = 편미분 × u', rowT.term, dT * uT, 1e-9)
  ok('편미분식 글자 L', rowL.partialText === '4*pi^2/T^2', rowL.partialText)
  ok('편미분식 글자 T', rowT.partialText === '-8*pi^2*L/T^3', rowT.partialText)
  close('Σ항² = u_c²', E.sumSquares, r.uncertainty ** 2, 1e-9)
  close('u_c = √(Σ항²) = 직접 계산한 값', Math.sqrt(E.sumSquares), Math.sqrt((dL * uL) ** 2 + (dT * uT) ** 2), 1e-9)
  close('기여율: T', rowT.share, ((dT * uT) ** 2 / ((dL * uL) ** 2 + (dT * uT) ** 2)) * 100, 1e-9)
  close('기여율 합 100', E.rows.reduce((s, x) => s + x.share, 0), 100, 1e-9)
  ok('큰 기여가 앞에 (T)', E.rows[0].name === 'T')
  ok('정리한 식', E.formulaText === '4*pi^2*L/T^2', E.formulaText)
  ok('각도 변수 없음: 안내 없음', E.angleNotes.length === 0 && E.rows.every((x) => !x.radians))
}

console.log('\n[2] 계산 블록을 거친 식 (펼친 식을 정리해서 보여준다)')
{
  const T = measure('T', '10\n12\n11\n13', '0.5')
  const r = evaluateCalc('T2 / T', [T, calc('T2', 'T^2')], 'rad')
  ok('T²/T 는 T 로 정리된다', r.explain.formulaText === 'T', r.explain.formulaText)
  ok('변수는 T 하나', r.explain.rows.length === 1 && r.explain.rows[0].name === 'T')
  close('∂f/∂T = 1', r.explain.rows[0].partial, 1, 1e-12)
  ok('편미분식 = 1', r.explain.rows[0].partialText === '1', r.explain.rows[0].partialText)
  close('기여율 100', r.explain.rows[0].share, 100, 1e-12)
}

console.log('\n[3] 도(°) 단위: 삼각함수 안의 변수는 라디안으로 바꿔 미분')
{
  const a = measure('a', '30\n30\n30', '1'), b = measure('b', '2\n2\n2', '0.1')
  const r = evaluateCalc('sin(a) * b', [a, b], 'deg')
  const rowA = r.explain.rows.find((x) => x.name === 'a'), rowB = r.explain.rows.find((x) => x.name === 'b')
  ok('a 는 라디안으로 바꿨다고 표시, b 는 아님', rowA.radians === true && rowB.radians === false)
  ok('각도 변환 안내 1개', r.explain.angleNotes.length === 1 && r.explain.angleNotes[0].startsWith('a:'), JSON.stringify(r.explain.angleNotes))
  const rad = (x) => (x * Math.PI) / 180
  close('∂f/∂a = cos(30°)·b (라디안 기준)', rowA.partial, Math.cos(rad(30)) * 2, 1e-9)
  close('항 = ∂f/∂a · (1° 를 라디안으로)', rowA.term, Math.cos(rad(30)) * 2 * rad(1), 1e-9)
  ok('편미분식 b*cos(a) (변수를 앞에)', rowA.partialText === 'b*cos(a)', rowA.partialText)
  ok('안내에 라디안 값(유효숫자 6자리)', r.explain.angleNotes[0].includes('0.0174533 rad') && !r.explain.angleNotes[0].includes('0.01745329251'), r.explain.angleNotes[0])
  const radMode = evaluateCalc('sin(a) * b', [a, b], 'rad')
  ok('라디안 모드에서는 변환 안내가 없다', radMode.explain.angleNotes.length === 0 && radMode.explain.rows.every((x) => !x.radians))
}

console.log('\n[4] 여러 함수가 섞인 식')
{
  const r = evaluateCalc('exp(-k*t) * ln(1 + x)', [measure('k', '0.35\n0.35\n0.35', '0.01'), measure('t', '4.2\n4.2\n4.2', '0.1'), measure('x', '2.5\n2.5\n2.5', '0.05')], 'rad')
  const rows = Object.fromEntries(r.explain.rows.map((x) => [x.name, x]))
  const k = 0.35, t = 4.2, x = 2.5
  close('∂f/∂k = -t·e^(-kt)·ln(1+x)', rows.k.partial, -t * Math.exp(-k * t) * Math.log(1 + x), 1e-9)
  close('∂f/∂x = e^(-kt)/(1+x)', rows.x.partial, Math.exp(-k * t) / (1 + x), 1e-9)
  ok('식 글자에 exp 와 ln 이 들어 있다', rows.k.partialText.includes('exp(-k*t)') && rows.k.partialText.includes('ln(1 + x)'), rows.k.partialText)
  ok('∂f/∂x 식', rows.x.partialText === 'exp(-k*t)/(1 + x)', rows.x.partialText)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
