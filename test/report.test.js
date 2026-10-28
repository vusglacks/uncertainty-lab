import { tableToTsv, tableToHtml } from '../src/lib/exportTable.js'
import { buildReport, MEASURE_HEADER, CALC_HEADER } from '../src/lib/report.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
const measure = (name, rawText, typeB = '', unit = '') => ({ id: name, type: 'measure', name, unit, rawText, typeB })

console.log('\n[1] 표 → 클립보드 글자')
{
  const rows = [['이름', '값'], ['L', '1.0000 ± 0.0009 m'], ['메모', '줄\n바꿈\t탭']]
  ok('TSV: 칸은 탭, 줄은 줄바꿈', tableToTsv(rows).split('\n').length === 3 && tableToTsv(rows).split('\n')[1] === 'L\t1.0000 ± 0.0009 m')
  ok('TSV: 칸 안의 탭·줄바꿈은 공백으로', tableToTsv(rows).split('\n')[2] === '메모\t줄 바꿈 탭')
  const html = tableToHtml([['a<b', 'x&y'], ['"q"', '1']])
  ok('HTML: <table> 한 개, 머리글 th', html.startsWith('<table') && html.includes('<th') && html.includes('<td'))
  ok('HTML: 특수문자는 이스케이프', html.includes('a&lt;b') && html.includes('x&amp;y') && html.includes('&quot;q&quot;') && !html.includes('a<b'))
}

console.log('\n[2] 보고서 표')
{
  const blocks = [
    measure('L', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005', 'm'),
    measure('T', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001', 's'),
    { id: 'g', type: 'calc', name: 'g', formula: '4*pi^2*L / T^2' },
    { id: 'x', type: 'calc', name: 'bad', formula: 'q*2' },
    { id: 'e', type: 'calc', name: 'empty', formula: '' },
    { id: 'gr', type: 'graph', name: undefined, xName: 'L', yName: 'T', fit: 'linear' },
  ]
  const r = buildReport(blocks, 'deg')
  ok('측정 표: 머리글 + 2줄', r.measure.length === 3 && r.measure[0] === MEASURE_HEADER)
  ok('측정 표: 열 개수가 머리글과 같다', r.measure.every((row) => row.length === MEASURE_HEADER.length))
  ok('측정 표 L 줄', r.measure[1][0] === 'L' && r.measure[1][2] === '5' && r.measure[1][3] === '1' && r.measure[1][8] === '1.0000 ± 0.0009 m', JSON.stringify(r.measure[1]))
  ok('측정 표 T 줄(결과 문자열)', r.measure[2][8] === '2.0060 ± 0.0013 s', r.measure[2][8])
  ok('계산 표: 머리글 + 3줄', r.calc.length === 4 && r.calc[0] === CALC_HEADER)
  ok('계산 결과 g = 9.811 ± 0.015', r.calc[1][2] === '9.811 ± 0.015', r.calc[1][2])
  ok('기여도 문자열 (큰 순서)', r.calc[1][3] === 'T 66.5%, L 33.5%', r.calc[1][3])
  ok('계산 못 하면 이유를 적는다', r.calc[2][2].startsWith('계산할 수 없음'), r.calc[2][2])
  ok('빈 수식은 -', r.calc[3][2] === '-')
  ok('그래프 1개, 제목', r.graphs.length === 1 && r.graphs[0].title === '그래프 1' && r.graphs[0].model.ok)
  const none = buildReport([], 'deg')
  ok('블록이 없으면 머리글만', none.measure.length === 1 && none.calc.length === 1 && none.graphs.length === 0)
  const blank = buildReport([measure('', '')], 'deg')
  ok('값이 없는 측정 블록은 - 로 채움', blank.measure[1][0] === '-' && blank.measure[1][2] === '0' && blank.measure[1][8] === '-')
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
