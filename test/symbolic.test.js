import { parse, collectVars, evalAD } from '../src/lib/engine.js'
import { differentiate, simplify, nodeToText, partialText, simplifiedText, angleVarIds } from '../src/lib/symbolic.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b))

// 자동 미분(engine.js)이 구한 편미분 값
function autoPartial(formula, values, v) {
  const ast = parse(formula)
  const vars = collectVars(ast)
  return evalAD(ast, values, vars).d[vars.indexOf(v)]
}
// 기호 미분으로 만든 식에 같은 값을 넣어 계산한 편미분 값
function symPartial(formula, values, v) {
  const ast = parse(formula)
  const vars = collectVars(ast)
  return evalAD(differentiate(ast, v), values, vars).v
}
const text = (formula, v) => partialText(formula, v)

console.log('\n[1] 기호 미분 = 자동 미분 (여러 식, 모든 변수)')
{
  const cases = [
    ['4*pi^2*L / T^2', { L: 1.002, T: 2.005 }],
    ['m / V', { m: 10, V: 5 }],
    ['x^2', { x: 3.3 }], ['x^3 + 2*x - 7', { x: 1.7 }], ['3*x^2 + 2*x', { x: 0.9 }],
    ['(x + 1)^2', { x: 2.4 }], ['1 / x', { x: 1.9 }], ['x*y*z', { x: 2, y: 3, z: 5 }],
    ['sin(x)', { x: 0.7 }], ['cos(x)', { x: 0.7 }], ['tan(x)', { x: 0.7 }],
    ['asin(x)', { x: 0.4 }], ['acos(x)', { x: 0.4 }], ['atan(x)', { x: 0.4 }],
    ['exp(x)', { x: 1.3 }], ['exp(-k*t)', { k: 0.35, t: 4.2 }], ['ln(x)', { x: 2.5 }], ['log(x)', { x: 2.5 }],
    ['sqrt(x)', { x: 2.5 }], ['abs(x)', { x: -2.5 }],
    ['sin(a)/sin(b)', { a: 0.7854, b: 0.5236 }], ['exp(-k*t)*ln(1+x)', { k: 0.35, t: 4.2, x: 2.5 }],
    ['x*exp(-x)', { x: 1.2 }], ['x^y', { x: 2.5, y: 1.7 }], ['2^x', { x: 1.3 }], ['x^x', { x: 1.5 }],
    ['sqrt(x^2 + y^2)', { x: 3, y: 4 }], ['1/tan(a)', { a: 0.9 }], ['(a + b)/(a - b)', { a: 5, b: 2 }],
    ['ln(sin(x)^2 + 1)', { x: 0.8 }], ['a*b^2/c^3 - d', { a: 2, b: 3, c: 1.5, d: 4 }],
    ['-x^2 + 3*(-x)', { x: 1.4 }], ['x/2 + y/3', { x: 2, y: 5 }], ['(2*x)^3', { x: 1.1 }],
    ['sqrt(x)*sqrt(x)', { x: 2.2 }], ['x*x*x', { x: 1.6 }], ['exp(2*x)/exp(x)', { x: 0.6 }],
  ]
  let bad = []
  for (const [f, values] of cases) {
    for (const v of Object.keys(values)) {
      const a = autoPartial(f, values, v), b = symPartial(f, values, v)
      if (!(rel(a, b) < 1e-9 || Math.abs(a - b) < 1e-12)) bad.push(`${f} ∂${v}: 자동 ${a} / 기호 ${b}`)
    }
  }
  ok(`${cases.length}개 식의 모든 편미분이 자동 미분과 일치`, bad.length === 0, bad.join(' | '))
}

console.log('\n[2] 정리(simplify)는 값을 바꾸지 않는다')
{
  const fs = ['(4*pi^2*L * (2*T)) / (T^2)^2', 'x + x + x', '2*x*3*y/6', 'x/y*y', '(x+1)*(x+1)', 'x*exp(-x) + x*exp(-x)', '3 - 3 + x', 'x^2*x^-1', 'sin(2*x)*2/2', '-(-x)', '(x - y) - (x - y)', 'a/(b*c)']
  const values = { x: 1.7, y: 2.3, a: 3.1, b: 1.3, c: 0.7, L: 1.01, T: 2.02 }
  let bad = []
  for (const f of fs) {
    const ast = parse(f), vars = collectVars(ast)
    const v1 = evalAD(ast, values, vars).v, v2 = evalAD(simplify(ast), values, vars).v
    if (!(rel(v1, v2) < 1e-12 || Math.abs(v1 - v2) < 1e-12)) bad.push(`${f}: ${v1} vs ${v2}`)
  }
  ok('값이 같다', bad.length === 0, bad.join(' | '))
  ok('같은 항은 묶인다: x + x + x → 3*x', simplifiedText('x + x + x') === '3*x', simplifiedText('x + x + x'))
  ok('약분: x/y*y → x', simplifiedText('x/y*y') === 'x', simplifiedText('x/y*y'))
  ok('상쇄: (x - y) - (x - y) → 0', simplifiedText('(x - y) - (x - y)') === '0', simplifiedText('(x - y) - (x - y)'))
  ok('계수 정리: 2*x*3*y/6 → x*y', simplifiedText('2*x*3*y/6') === 'x*y', simplifiedText('2*x*3*y/6'))
  ok('거듭제곱의 거듭제곱: (x^2)^3 → x^6', simplifiedText('(x^2)^3') === 'x^6', simplifiedText('(x^2)^3'))
}

console.log('\n[3] 편미분식 글자 (손으로 미분한 결과와 비교)')
{
  const t = (f, v, want) => ok(`∂/∂${v} ${f}  →  ${want}`, text(f, v) === want, `실제: ${text(f, v)}`)
  // 단진자 g = 4π²L/T²:  ∂g/∂L = 4π²/T²,  ∂g/∂T = -2·4π²L/T³ = -8π²L/T³
  t('4*pi^2*L / T^2', 'L', '4*pi^2/T^2')
  t('4*pi^2*L / T^2', 'T', '-8*pi^2*L/T^3')
  t('m / V', 'm', '1/V')
  t('m / V', 'V', '-m/V^2')
  t('x^2', 'x', '2*x')
  t('x^3', 'x', '3*x^2')
  t('3*x^2 + 2*x', 'x', '6*x + 2')
  t('(x + 1)^2', 'x', '2*(x + 1)')
  t('1/x', 'x', '-1/x^2')
  t('sin(x)', 'x', 'cos(x)')
  t('cos(x)', 'x', '-sin(x)')
  t('exp(-k*t)', 'k', '-t*exp(-k*t)')
  t('exp(-k*t)', 't', '-k*exp(-k*t)')
  t('ln(x)', 'x', '1/x')
  t('sqrt(x)', 'x', '1/(2*sqrt(x))')
  t('sin(a)/sin(b)', 'b', '-sin(a)*cos(b)/sin(b)^2')
  t('sin(a)/sin(b)', 'a', 'cos(a)/sin(b)')
  t('x*exp(-x)', 'x', 'exp(-x) - x*exp(-x)')
  t('x^y', 'y', 'x^y*ln(x)')
  t('5', 'x', '0')
  t('y', 'x', '0')
}

console.log('\n[4] 글자 모양과 이름 바꾸기')
{
  ok('변수 이름을 화면 이름으로 바꾼다', partialText('4*pi^2*__v0 / __v1^2', '__v1', (n) => ({ __v0: 'L', __v1: 'T' })[n] ?? n) === '-8*pi^2*L/T^3')
  ok('너무 긴 식은 생략(null)', partialText('(' + Array.from({ length: 60 }, (_, i) => `sin(x*${i + 2})`).join(' + ') + ')^3', 'x') === null)
  ok('nodeToText: 우선순위에 맞게 괄호', nodeToText(parse('(a + b)*c - d/(e*f)')) === '(a + b)*c - d/(e*f)', nodeToText(parse('(a + b)*c - d/(e*f)')))
  ok('nodeToText: 거듭제곱은 오른쪽 결합', nodeToText(parse('2^3^2')) === '2^3^2' && nodeToText(parse('(2^3)^2')) === '(2^3)^2', nodeToText(parse('2^3^2')))
  ok('nodeToText: a - (b - c) 괄호 유지', nodeToText(parse('a - (b - c)')) === 'a - (b - c)')
  ok('pi 와 e 는 이름 그대로', nodeToText(parse('pi*e')) === 'pi*e')
  ok('정리한 식을 다시 읽어도 같은 값 (왕복)', (() => { const s = simplifiedText('(a+b)*(a+b)/c'); const v = { a: 1.3, b: 2.1, c: 0.9 }; const f1 = evalAD(parse('(a+b)*(a+b)/c'), v, ['a', 'b', 'c']).v, f2 = evalAD(parse(s), v, ['a', 'b', 'c']).v; return rel(f1, f2) < 1e-12 })())
}

console.log('\n[5] 삼각함수 안의 변수 (도 단위에서 라디안으로 바뀌는 변수)')
{
  const ids = (f) => [...angleVarIds(parse(f))].sort().join(',')
  ok('sin(a)', ids('sin(a)') === 'a')
  ok('sin(a) + b → a 만', ids('sin(a) + b') === 'a')
  ok('cos(2*a)/tan(b)', ids('cos(2*a)/tan(b)') === 'a,b')
  ok('sqrt(sin(a)^2 + c)', ids('sqrt(sin(a)^2 + c)') === 'a')
  ok('삼각함수가 없으면 없음', ids('a*b + exp(c)') === '')
  ok('asin 안의 변수는 각도가 아님', ids('asin(x)') === '')
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
