import { parseHand, compareHand } from '../src/lib/compare.js'
import { evaluateCalc } from '../src/lib/calc.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}

console.log('\n[1] 손으로 쓴 글자 읽기')
{
  ok('빈칸', parseHand('  ').empty === true && parseHand(undefined).empty === true)
  ok('값만', parseHand('9.81').value === 9.81 && parseHand('9.81').uncertainty === null)
  ok('값 ± 불확도', parseHand('9.81 ± 0.02').uncertainty === 0.02)
  ok('+- 와 +/- 도 된다', parseHand('9.81+-0.02').uncertainty === 0.02 && parseHand('9.81 +/- 0.02').uncertainty === 0.02)
  ok('유니코드 마이너스', parseHand('−1.5').value === -1.5)
  ok('과학 표기', parseHand('1.5e-3').value === 0.0015)
  ok('숫자가 아니면 오류', parseHand('abc').ok === false && parseHand('9.81 ± x').ok === false)
  ok('± 가 두 번이면 오류', parseHand('1 ± 2 ± 3').ok === false)
  ok('음수 불확도는 오류', parseHand('1 ± -2').ok === false)
}

console.log('\n[2] 비교 (g = 9.811 ± 0.015 인 단진자)')
{
  const m = (name, rawText, typeB, unit) => ({ id: name, type: 'measure', name, unit, rawText, typeB })
  const blocks = [
    m('L', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005', 'm'),
    m('T', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001', 's'),
  ]
  const r = evaluateCalc('4*pi^2*L / T^2', blocks, 'deg')
  ok('기준: 9.811 ± 0.015', r.text === '9.811 ± 0.015', r.text)
  const c = (t) => compareHand(r.value, r.uncertainty, t)

  let x = c('9.811 ± 0.015')
  ok('똑같이 쓰면 모두 일치', x.ok && x.allMatch && x.valueCheck.match && x.uncertaintyCheck.match, JSON.stringify(x))
  x = c('9.8112 ± 0.01469')
  ok('자리가 더 많아도 반올림해서 일치 (불확도는 올림 0.015)', x.allMatch, JSON.stringify(x))
  x = c('9.8112 ± 0.0146')
  ok('불확도 0.0146 -> 반올림 0.015 도 인정', x.uncertaintyCheck.match)
  x = c('9.811')
  ok('값만 써도 된다 (불확도 검사는 없다)', x.allMatch && x.uncertaintyCheck === null)
  x = c('9.81')
  ok('9.81 은 표시값 9.811 과 다르다 (불일치)', x.valueCheck.match === false && x.allMatch === false)
  ok('  차이 % = |9.81-9.8113|/9.8113', Math.abs(x.valueCheck.pct - (Math.abs(9.81 - r.value) / r.value) * 100) < 1e-12)
  ok('  차이가 작으면 반올림 안내', x.valueCheck.hint.includes('반올림'), x.valueCheck.hint)
  x = c('9.95 ± 0.015')
  ok('값이 1.4% 쯤 다르면 확인 안내', x.valueCheck.match === false && x.valueCheck.pct > 1.3 && x.valueCheck.pct < 1.5 && x.valueCheck.hint.includes('확인'), JSON.stringify(x.valueCheck))
  x = c('2.4 ± 0.015')
  ok('크게 다르면 많이 달라요', x.valueCheck.hint.includes('많이'), x.valueCheck.hint)
  x = c('9.811 ± 0.02')
  ok('값은 맞고 불확도만 틀리면 부분 일치', x.valueCheck.match && !x.uncertaintyCheck.match && !x.allMatch)
  x = c('9.811 ± 0.014')
  ok('불확도 0.014 는 불일치', x.uncertaintyCheck.match === false)
  ok('표시 문자열', x.shownText === '9.811 ± 0.015')
  ok('읽을 수 없으면 오류 그대로', c('열').ok === false)
  ok('빈칸은 empty', c('').empty === true)
}

console.log('\n[3] 유효숫자 2자리 규칙 / 불확도 0 / 값 0')
{
  // 불확도 0.0128 -> 첫 자리가 1이라 2자리: 2.000 ± 0.013
  const a = compareHand(2.0, 0.0128, '2.000 ± 0.013')
  ok('2.000 ± 0.013 일치', a.allMatch)
  ok('2.0 은 2.000 과 같은 값이라 일치 (자리만 반올림)', compareHand(2.0, 0.0128, '2.0 ± 0.013').valueCheck.match)
  const b = compareHand(9.7823, 0.0456, '9.78 ± 0.05')
  ok('9.78 ± 0.05 일치', b.allMatch, JSON.stringify(b))
  ok('9.8 ± 0.05 는 값 불일치', compareHand(9.7823, 0.0456, '9.8 ± 0.05').valueCheck.match === false)
  const z = compareHand(12.345678, 0, '12.35')
  ok('불확도 0이면 4자리로 비교', z.valueCheck.match && z.valueCheck.shown === '12.35', JSON.stringify(z))
  ok('불확도 0 에 손으로 0 을 쓰면 일치', compareHand(5, 0, '5 ± 0').uncertaintyCheck.match)
  ok('프로그램 값이 0 이면 차이 % 는 null', compareHand(0, 0.5, '0.1').valueCheck.pct === null)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
