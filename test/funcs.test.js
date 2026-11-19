import { parse, collectVars, evalAD, propagate, numericPartials } from '../src/lib/engine.js'
import { differentiate } from '../src/lib/symbolic.js'
import { evaluateCalc } from '../src/lib/calc.js'
import { FUNCTION_GROUPS, CONSTANTS } from '../src/lib/functions.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
function close(label, got, want, tol = 1e-9) {
  const good = want === 0 ? Math.abs(got) < 1e-12 : Math.abs(got - want) <= tol * Math.abs(want)
  ok(label, good, `got ${got}, want ${want}`)
}
const inp = (value, uncertainty = 0.01) => ({ value, uncertainty })
const measure = (name, rawText, typeB = '') => ({ id: name, type: 'measure', name, unit: '', rawText, typeB })
const throws = (fn) => { try { fn(); return null } catch (e) { return e.message } }

console.log('\n[1] 새 함수: 값과 도함수 (손으로 알고 있는 값, 자동 미분, 수치 미분, 기호 미분 모두 대조)')
{
  const cases = [
    // [식, 입력, 기대값(손계산), 기대 도함수(손계산)]
    ['sinh(x)', 0.8, Math.sinh(0.8), Math.cosh(0.8)],
    ['cosh(x)', 0.8, Math.cosh(0.8), Math.sinh(0.8)],
    ['tanh(x)', 0.8, Math.tanh(0.8), 1 - Math.tanh(0.8) ** 2], // (tanh)' = 1 - tanh²
    ['log2(x)', 8, 3, 1 / (8 * Math.log(2))], // log2(8) = 3,  (log2 x)' = 1/(x ln2)
    ['cbrt(x)', 8, 2, 1 / 12], // ∛8 = 2,  (∛x)' = 1/(3·x^(2/3)) = 1/(3·4)
    ['cbrt(x)', -8, -2, 1 / 12], // 음수도 가능, 도함수는 양수
  ]
  for (const [f, x, v, d] of cases) {
    const r = propagate(f, { x: inp(x, 0.01) })
    close(`${f} @ ${x}: 값`, r.value, v)
    close(`${f} @ ${x}: 도함수(자동 미분)`, r.terms[0].partial, d)
    close(`${f} @ ${x}: 불확도 = |f'|·u`, r.uncertainty, Math.abs(d) * 0.01)
    const num = numericPartials(f, { x: inp(x) })
    ok(`${f} @ ${x}: 수치 미분과 일치`, Math.abs(num.x - d) < 1e-6 * Math.max(1, Math.abs(d)), `${num.x} vs ${d}`)
    const ast = parse(f), vars = collectVars(ast)
    close(`${f} @ ${x}: 기호 미분과 일치`, evalAD(differentiate(ast, 'x'), { x }, vars).v, d, 1e-9)
  }
  ok('log2 정의역 오류', throws(() => propagate('log2(x)', { x: inp(0) })) !== null)
  ok('log2 음수 오류', throws(() => propagate('log2(x)', { x: inp(-1) })) !== null)
  ok('이름이 같은 변수와 혼동 없음 (sinh 는 함수)', propagate('sinh(x)*cosh(x)', { x: inp(0.5) }).value > 0)
}

console.log('\n[2] 도 단위의 asin/acos/atan: 결과를 도로 변환, 미분도 같은 계수')
{
  const K = 180 / Math.PI
  close('asin(0.5) = 30°', propagate('asin(x)', { x: inp(0.5, 0) }, { degrees: true }).value, 30, 1e-12)
  close('acos(0.5) = 60°', propagate('acos(x)', { x: inp(0.5, 0) }, { degrees: true }).value, 60, 1e-12)
  close('atan(1) = 45°', propagate('atan(x)', { x: inp(1, 0) }, { degrees: true }).value, 45, 1e-12)
  close('라디안 모드는 그대로: asin(0.5) = π/6', propagate('asin(x)', { x: inp(0.5, 0) }, { degrees: false }).value, Math.PI / 6, 1e-12)
  // d/dx asin(x) (도) = (180/π)/√(1-x²)  = 57.2958/0.866025 = 66.1593 @ x = 0.5, u = 0.01 → 0.661593°
  const a = propagate('asin(x)', { x: inp(0.5, 0.01) }, { degrees: true })
  close('asin 도함수 (180/π)/√(1-x²)', a.terms[0].partial, K / Math.sqrt(0.75), 1e-12)
  close('asin 불확도 0.01 → 0.6616°', a.uncertainty, (K / Math.sqrt(0.75)) * 0.01, 1e-12)
  close('acos 도함수 -(180/π)/√(1-x²)', propagate('acos(x)', { x: inp(0.5) }, { degrees: true }).terms[0].partial, -K / Math.sqrt(0.75), 1e-12)
  close('atan 도함수 (180/π)/(1+x²) @ 1 = 28.6479', propagate('atan(x)', { x: inp(1) }, { degrees: true }).terms[0].partial, K / 2, 1e-12)
  const num = numericPartials('asin(x)', { x: inp(0.5) }, 1e-6, true)
  close('수치 미분(도)과 일치', num.x, K / Math.sqrt(0.75), 1e-6)
  const ast = parse('atan(x)'), vars = collectVars(ast)
  close('기호 미분(도)과 일치', evalAD(differentiate(ast, 'x', { degrees: true }), { x: 1 }, vars).v, K / 2, 1e-12)
  // 합성: asin(sin(a)) — a = 30° ± 1° 이면 결과도 30° ± 1°
  const c = propagate('asin(sin(a))', { a: inp(30, 1) }, { degrees: true })
  close('asin(sin(30°)) = 30°', c.value, 30, 1e-9)
  close('불확도 1° 가 그대로 전해진다', c.uncertainty, 1, 1e-9)
  // 비율 x 는 각도가 아니므로 라디안으로 바뀌지 않는다
  const m = propagate('sin(a) + asin(x)', { a: inp(30, 1), x: inp(0.5, 0.01) }, { degrees: true })
  close('sin(30°) + asin(0.5)(=30°) = 30.5', m.value, 30.5, 1e-9)
  // 같은 식이 sin(a) 의 a 만 라디안으로 바뀐다
  const rad = Math.PI / 180
  close('불확도: a 항은 라디안 기준, x 항은 도 기준', m.uncertainty, Math.sqrt((Math.cos(30 * rad) * rad) ** 2 + (K / Math.sqrt(0.75) * 0.01) ** 2), 1e-9)
}

console.log('\n[3] 도 단위에서 sin(asin(x)) 같은 식은 틀린 값 대신 오류')
{
  const msg = throws(() => propagate('sin(asin(x))', { x: inp(0.5) }, { degrees: true }))
  ok('도 단위: 오류 메시지', msg !== null && msg.includes('도 단위') && msg.includes('asin'), String(msg))
  ok('도 단위: 더 깊이 들어 있어도 감지 (cos(2*atan(x)))', throws(() => propagate('cos(2*atan(x))', { x: inp(1) }, { degrees: true })) !== null)
  close('라디안 모드에서는 정상: sin(asin(0.5)) = 0.5', propagate('sin(asin(x))', { x: inp(0.5) }, { degrees: false }).value, 0.5, 1e-12)
  ok('asin 안에 sin 은 괜찮다', throws(() => propagate('asin(sin(a))', { a: inp(30) }, { degrees: true })) === null)
  ok('sin 과 asin 을 따로 더하는 건 괜찮다', throws(() => propagate('sin(a) + asin(x)', { a: inp(30), x: inp(0.5) }, { degrees: true })) === null)
  const r = evaluateCalc('sin(asin(x))', [measure('x', '0.5\n0.5\n0.5', '0.01')], 'deg')
  ok('계산 블록에서는 안내 문구로 보인다', !r.ok && r.message.includes('도 단위'), JSON.stringify(r))
}

console.log('\n[4] 계산 블록·계산 과정 화면에서도 일관')
{
  const x = measure('x', '0.5\n0.5\n0.5', '0.01')
  const d = evaluateCalc('asin(x)', [x], 'deg')
  close('계산 블록: asin(0.5) = 30°', d.value, 30, 1e-9)
  ok('계산 과정의 편미분식에 180/pi 가 들어 있다', d.explain.rows[0].partialText.includes('180') && d.explain.rows[0].partialText.includes('pi'), d.explain.rows[0].partialText)
  close('계산 과정의 편미분 값 = 66.1593', d.explain.rows[0].partial, (180 / Math.PI) / Math.sqrt(0.75), 1e-9)
  ok('asin 안의 변수는 라디안 변환 안내 대상이 아니다', d.explain.angleNotes.length === 0 && !d.explain.rows[0].radians)
  const rad = evaluateCalc('asin(x)', [x], 'rad')
  close('라디안 모드: asin(0.5) = π/6', rad.value, Math.PI / 6, 1e-12)
  ok('라디안 모드의 편미분식에는 180 이 없다', !rad.explain.rows[0].partialText.includes('180'))
  const cb = evaluateCalc('cbrt(x)', [measure('x', '8\n8\n8', '0.12')], 'rad')
  close('cbrt(8) = 2', cb.value, 2, 1e-12)
  close('cbrt 불확도 = 0.12/12 = 0.01', cb.uncertainty, 0.01, 1e-12)
  ok('cbrt(0) 은 숫자가 아니라는 안내', evaluateCalc('cbrt(x)', [measure('x', '0\n0\n0', '0.1')], 'rad').ok === false)
}

console.log('\n[5] 함수 목록(도움말)과 engine.js 가 어긋나지 않는다')
{
  const listed = FUNCTION_GROUPS.flatMap((g) => g.names)
  ok('도움말의 모든 함수가 실제로 계산된다', listed.every((n) => { try { propagate(`${n}(x)`, { x: inp(0.5) }); return true } catch { return false } }), listed.join(','))
  const candidates = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'ln', 'log', 'log2', 'sqrt', 'cbrt', 'abs', 'pow', 'sign', 'floor', 'ceil', 'round', 'atan2', 'log10']
  const supported = candidates.filter((n) => { const m = throws(() => parse(`${n}(1)`)); return m === null })
  ok('엔진이 받아들이는 함수는 모두 도움말에 있다', supported.every((n) => listed.includes(n)), `엔진만: ${supported.filter((n) => !listed.includes(n)).join(',')}`)
  ok('도움말에 중복이 없다', new Set(listed).size === listed.length)
  ok('상수 pi, e', CONSTANTS.every((c) => propagate(`${c}*1`, {}).value > 0))
  close('log(1000) = 3 (상용로그)', propagate('log(x)', { x: inp(1000, 0) }).value, 3, 1e-12)
  close('ln(e) = 1 (자연로그)', propagate('ln(e)', {}).value, 1, 1e-12)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
