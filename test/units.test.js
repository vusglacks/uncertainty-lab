import { parseUnit, unitText, dimEqual, namedUnit, mulQ, powQ } from '../src/lib/units.js'
import { compileFormula } from '../src/lib/expand.js'
import { analyzeUnits } from '../src/lib/unitcheck.js'
import { evaluateCalc, evaluateRows } from '../src/lib/calc.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
const measure = (name, unit, rawText = '1\n2\n3', typeB = '0.01') => ({ id: name, type: 'measure', name, unit, rawText, typeB })
const calc = (name, formula) => ({ id: name, type: 'calc', name, formula })

// 수식 + 위쪽 블록 -> 단위 분석 결과
function check(formula, blocks, angle = 'deg') {
  const c = compileFormula(formula, blocks)
  if (!c.ok) throw new Error(c.message)
  return analyzeUnits(c.expr, c.vars, angle)
}

console.log('\n[1] 단위 글자 해석')
{
  const q = (t) => parseUnit(t).q
  ok('빈 글자 = 단위 없음', parseUnit('').ok && unitText(q('')) === '')
  ok('m/s^2', unitText(q('m/s^2')) === 'm/s²')
  ok('윗첨자 m/s²', unitText(q('m/s²')) === 'm/s²')
  ok('kg·m/s² 은 N 과 차원이 같다', dimEqual(q('kg·m/s²'), q('N')))
  ok('kg*m*s^-2 도 같은 차원', dimEqual(q('kg*m*s^-2'), q('N')))
  ok('cm 와 m 는 차원이 같다', dimEqual(q('cm'), q('m')))
  ok('cm 의 배율 0.01', Math.abs(q('cm').scale - 0.01) < 1e-15)
  ok('g 는 kg 차원, 배율 1e-3', dimEqual(q('g'), q('kg')) && Math.abs(q('g').scale - 1e-3) < 1e-18)
  ok('kg 는 접두어 k + g 로 읽힌다 (배율 1)', Math.abs(q('kg').scale - 1) < 1e-12)
  ok('mm 는 길이', dimEqual(q('mm'), q('m')))
  ok('min 은 m(밀리) + in 이 아니라 분(시간)', dimEqual(q('min'), q('s')) && Math.abs(q('min').scale - 60) < 1e-12)
  ok('kPa 는 압력', dimEqual(q('kPa'), q('Pa')) && Math.abs(q('kPa').scale - 1000) < 1e-9)
  ok('°, rad 는 차원 없음', Object.keys(q('°').dim).length === 0 && Object.keys(q('rad').dim).length === 0)
  ok('Ω 는 V/A', dimEqual(q('Ω'), q('V/A')))
  ok('m^(1/2)', unitText(q('m^(1/2)')) === 'm^0.5')
  ok('공백 곱 "N m"', dimEqual(q('N m'), q('J')))
  ok('1/s', unitText(q('1/s')) === '1/s' && dimEqual(q('1/s'), q('Hz')))
  ok('분모 여러 개 kg/(m·s)', unitText(q('kg/(m·s)')) === 'kg/(m·s)')
  ok('모르는 단위(개)는 새 단위, unknown 에 기록', parseUnit('개').unknown[0] === '개' && !dimEqual(q('개'), q('m')))
  ok('서로 다른 모르는 단위는 다르다', !dimEqual(q('개'), q('회')))
  ok('깨진 글자는 ok:false', !parseUnit('m/(s').ok && !parseUnit('m^').ok)
  ok('N 이름 찾기', namedUnit(mulQ(q('kg'), q('m/s^2'))) === 'N')
  ok('cm 가 섞이면 이름을 안 붙인다', namedUnit(mulQ(q('g'), q('m/s^2'))) === null)
  ok('m^2 의 제곱근은 m', unitText(powQ(q('m^2'), 0.5)) === 'm')
  ok('m^3 의 세제곱근도 m (부동소수점 찌꺼기 없음)', unitText(powQ(q('m^3'), 1 / 3)) === 'm')
}

console.log('\n[2] 결과 단위 (손으로 계산한 값)')
{
  const L = measure('L', 'm'), T = measure('T', 's'), m = measure('m', 'kg'), a = measure('a', 'm/s²'), x = measure('x', 'cm')
  let r = check('4*pi^2*L / T^2', [L, T])
  ok('g = 4π²L/T²  ->  m/s²', r.text === 'm/s²' && r.warnings.length === 0, r.text + JSON.stringify(r.warnings))
  r = check('m*a', [m, a])
  ok('F = m·a  ->  kg·m/s², 이름 N', r.text === 'kg·m/s²' && r.named === 'N', r.text + r.named)
  r = check('m*a*L', [m, a, L])
  ok('W = F·L  ->  이름 J', r.named === 'J', r.text)
  r = check('sqrt(L/a)', [L, a])
  ok('sqrt(L/a)  ->  s', r.text === 's', r.text)
  r = check('L^3', [L])
  ok('L^3  ->  m³', r.text === 'm³')
  r = check('L / L', [L])
  ok('L/L  ->  단위 없음', r.text === '' && r.warnings.length === 0)
  r = check('2*L + L', [L])
  ok('2L + L  ->  m (경고 없음)', r.text === 'm' && r.warnings.length === 0, JSON.stringify(r.warnings))
  r = check('-L', [L])
  ok('음수는 단위 그대로', r.text === 'm')
  r = check('cbrt(L^3)', [L])
  ok('cbrt(m³) = m', r.text === 'm', r.text)
  r = check('abs(L)', [L])
  ok('abs 는 단위 그대로', r.text === 'm')
  r = check('sin(x/L)', [x, L])
  ok('sin(cm/m) 는 차원 없음이라 경고 없음', r.warnings.every((w) => !w.includes('sin')), JSON.stringify(r.warnings))
}

console.log('\n[3] 경고')
{
  const L = measure('L', 'm'), T = measure('T', 's'), x = measure('x', 'cm'), th = measure('th', '°'), n = measure('n', '')
  let r = check('L + T', [L, T])
  ok('m + s -> 단위 안 맞음 경고, 결과 단위 없음', r.warnings.length === 1 && r.warnings[0].includes("'L + T'") && r.warnings[0].includes('더할'), JSON.stringify(r.warnings))
  ok('  결과 단위를 정할 수 없다', r.unit === null && r.text === '')
  r = check('L - T', [L, T])
  ok('m - s -> "뺄" 수 없어요', r.warnings[0].includes('뺄'))
  r = check('L + x', [L, x])
  ok('m + cm -> 단위 기호가 다르다는 경고만 (환산 안 함)', r.warnings.length === 1 && r.warnings[0].includes('단위 기호가 달라요') && r.warnings[0].includes('자동으로 환산하지 않'), JSON.stringify(r.warnings))
  ok('  그래도 결과 단위는 앞쪽(m)', r.text === 'm')
  r = check('sin(L)', [L])
  ok('sin(m) -> 경고', r.warnings.length === 1 && r.warnings[0].includes('sin( )'), JSON.stringify(r.warnings))
  r = check('exp(T)', [T])
  ok('exp(s) -> 경고', r.warnings.length === 1 && r.warnings[0].includes('exp( )'))
  r = check('sin(th)', [th])
  ok('sin(°) 는 정상', r.warnings.length === 0 && r.text === '')
  r = check('L^T', [L, T])
  ok('지수가 변수 + 단위 있음 -> 경고 둘', r.warnings.length === 2 && r.unit === null, JSON.stringify(r.warnings))
  r = check('n^2', [n])
  ok('단위가 전혀 없으면 검사 안 함', r.warnings.length === 0 && r.text === '')
  r = check('L*n', [L, n])
  ok('단위 칸이 빈 블록이 있으면 안내(notes)', r.notes.length === 1 && r.notes[0].includes('n') && r.text === 'm', JSON.stringify(r.notes))
  r = check('L + 1', [L])
  ok('m + 숫자 -> 경고', r.warnings.length === 1)
  r = check('asin(x/L)', [x, L], 'deg')
  ok('asin 결과는 도(deg 모드)', r.text === '°', r.text)
  r = check('atan(x/L)', [x, L], 'rad')
  ok('atan 결과는 rad (rad 모드)', r.text === 'rad', r.text)
  r = check('asin(L)', [L])
  ok('asin(m) -> 경고', r.warnings.length === 1)
}

console.log('\n[4] 계산 블록 결과에 연결')
{
  const L = measure('L', 'm', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005')
  const T = measure('T', 's', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001')
  const r = evaluateCalc('4*pi^2*L / T^2', [L, T], 'deg')
  ok('evaluateCalc 가 단위를 돌려준다', r.ok && r.units.text === 'm/s²' && r.units.warnings.length === 0, JSON.stringify(r.units))
  ok('값은 그대로 g = 9.811 ± 0.015', r.text === '9.811 ± 0.015', r.text)
  const bad = evaluateCalc('L + T', [L, T], 'deg')
  ok('단위 경고가 있어도 계산은 한다', bad.ok && bad.units.warnings.length === 1 && bad.units.text === '', JSON.stringify(bad.units))
  const T2 = calc('T2', 'T^2')
  const chain = evaluateCalc('4*pi^2*L / T2', [L, T, T2], 'deg')
  ok('계산 블록을 이어 써도 단위가 펼쳐진다 (m/s²)', chain.ok && chain.units.text === 'm/s²', JSON.stringify(chain.units))
  const rows = evaluateRows('T^2', [L, T], 'deg')
  ok('evaluateRows 도 단위를 돌려준다 (s²)', rows.ok && rows.units.text === 's²', JSON.stringify(rows.units))
  const noUnit = evaluateCalc('L*T', [measure('L', '', '1\n2\n3'), measure('T', '', '4\n5\n6')], 'deg')
  ok('단위를 안 쓴 실험은 예전과 같다 (단위 글자 없음, 경고 없음)', noUnit.ok && noUnit.units.text === '' && noUnit.units.warnings.length === 0 && noUnit.units.notes.length === 0)
  const broken = evaluateCalc('L*2', [measure('L', 'm/(', '1\n2\n3')], 'deg')
  ok('읽을 수 없는 단위는 경고로 알리고 계산은 계속', broken.ok && broken.units.warnings.length === 1 && broken.units.warnings[0].includes('읽을 수 없어요'), JSON.stringify(broken.units))
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
