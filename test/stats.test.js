import {
  parseValues,
  mean,
  sampleStd,
  typeAUncertainty,
  parseTypeB,
  combinedUncertainty,
  measureStats,
} from '../src/lib/stats.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
// 상대오차 기준 비교 (기대값이 0이면 절대오차)
function close(label, got, want, tol = 1e-9) {
  const good = want === 0 ? Math.abs(got) < 1e-12 : Math.abs(got - want) <= tol * Math.abs(want)
  ok(label, good, `got ${got}, want ${want}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\n[1] 붙여넣기 해석')
{
  ok('엑셀 세로 복사 (CRLF + 끝 빈 줄)',
    same(parseValues('1.001\r\n0.998\r\n1.002\r\n1.000\r\n').values, [1.001, 0.998, 1.002, 1.0]))
  ok('엑셀 가로 복사 (탭)', same(parseValues('1.001\t0.998\t1.002').values, [1.001, 0.998, 1.002]))
  ok('표 복사 (탭 + 줄바꿈 섞임)', same(parseValues('1\t2\r\n3\t4').values, [1, 2, 3, 4]))
  ok('쉼표·세미콜론·공백 구분', same(parseValues('1,2;3 4').values, [1, 2, 3, 4]))
  ok('지수 표기', same(parseValues('1e-3 2.5E2').values, [0.001, 250]))
  ok('유니코드 마이너스(−)', same(parseValues('−1.5').values, [-1.5]))
  ok('앞뒤 공백·빈 입력', parseValues('  \n ').values.length === 0 && parseValues(undefined).values.length === 0)
  const r = parseValues('길이(m)\n1.0\nabc\n2.0\n0x10\nInfinity\n1.2.3')
  ok('숫자 아닌 조각은 values 에서 빼고 invalid 로 알려줌', same(r.values, [1, 2]))
  ok('invalid 목록', same(r.invalid, ['길이(m)', 'abc', '0x10', 'Infinity', '1.2.3']), JSON.stringify(r.invalid))
}

console.log('\n[2] 평균·표본표준편차 (n-1)')
{
  // 엑셀 STDEV.S({2,4,4,4,5,5,7,9}) = 2.13809 (모표준편차 STDEV.P 는 2)
  const xs = [2, 4, 4, 4, 5, 5, 7, 9]
  close('평균', mean(xs), 5)
  close('표본표준편차 = √(32/7)', sampleStd(xs), Math.sqrt(32 / 7))
  ok('모표준편차(2)와 다름', Math.abs(sampleStd(xs) - 2) > 0.1)
  ok('값 1개면 표준편차 null', sampleStd([3]) === null)
  ok('값 0개면 평균 null', mean([]) === null)
  const ys = [1.001, 0.998, 1.002, 1.0]
  close('평균 1.00025', mean(ys), 1.00025)
  close('표준편차 √(8.75e-6/3)', sampleStd(ys), Math.sqrt(8.75e-6 / 3))
  close('A형 = 표준편차/√n', typeAUncertainty(ys), Math.sqrt(8.75e-6 / 3) / 2)
  ok('값 1개면 A형 null', typeAUncertainty([3]) === null)
}

console.log('\n[3] B형·합성')
{
  ok('B형 빈칸 = 입력 안 함', same(parseTypeB(''), { value: 0, given: false, error: null }))
  ok('B형 숫자', parseTypeB(' 0.0005 ').value === 0.0005 && parseTypeB('0.0005').given)
  ok('B형 0도 입력으로 인정', parseTypeB('0').given === true)
  ok('B형 문자 → 오류', parseTypeB('abc').error !== null)
  ok('B형 음수 → 오류', parseTypeB('-1').error !== null)
  close('합성 √(3²+4²) = 5', combinedUncertainty(3, 4), 5)
}

console.log('\n[4] measureStats 종합')
{
  const ys = '1.001\n0.998\n1.002\n1.000'
  const uA = Math.sqrt(8.75e-6 / 3) / 2
  let s = measureStats({ rawText: ys, typeB: '0.0005' })
  ok('n = 4', s.n === 4)
  close('평균', s.mean, 1.00025)
  close('uA', s.uA, uA)
  close('uC = √(uA²+uB²)', s.uC, Math.sqrt(uA ** 2 + 0.0005 ** 2))
  s = measureStats({ rawText: ys, typeB: '' })
  close('B형 없으면 uC = uA', s.uC, uA)
  s = measureStats({ rawText: '5', typeB: '' })
  ok('값 1개 + B형 없음 → uC null', s.uC === null && s.std === null && s.mean === 5)
  s = measureStats({ rawText: '5', typeB: '0.01' })
  close('값 1개 + B형 → uC = uB', s.uC, 0.01)
  s = measureStats({ rawText: ys, typeB: 'abc' })
  ok('B형 입력 오류 → uC null + 메시지', s.uC === null && s.typeBError !== null)
  s = measureStats({ rawText: '', typeB: '' })
  ok('빈 블록', s.n === 0 && s.mean === null && s.uC === null)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
