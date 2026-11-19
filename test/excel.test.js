import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import writeExcelFile from 'write-excel-file/node'
import readExcelFile from 'read-excel-file/node'
import { parseCsv, columnLetter, guessNameUnit, detectColumns, columnsToBlocks, buildWorkbook } from '../src/lib/excel.js'
import { measureStats } from '../src/lib/stats.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\n[1] CSV 읽기')
{
  ok('쉼표 구분', same(parseCsv('a,b\n1,2\n3,4'), [['a', 'b'], ['1', '2'], ['3', '4']]))
  ok('탭 구분 (엑셀에서 복사한 글자)', same(parseCsv('L\tT\n1.0\t2.0'), [['L', 'T'], ['1.0', '2.0']]))
  ok('세미콜론 구분', same(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']]))
  ok('CRLF 줄바꿈과 BOM', same(parseCsv('﻿a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]))
  ok('따옴표 안의 쉼표·줄바꿈·"" 처리', same(parseCsv('x,y\n"1,5","줄\n바꿈 ""끝"""'), [['x', 'y'], ['1,5', '줄\n바꿈 "끝"']]))
  ok('끝의 빈 줄 무시', same(parseCsv('a\n1\n\n\n'), [['a'], ['1']]))
  ok('빈 글자는 빈 표', same(parseCsv(''), []))
  ok('빈 칸 유지', same(parseCsv('a,,c\n1,,3'), [['a', '', 'c'], ['1', '', '3']]))
}

console.log('\n[2] 열 이름·제목 해석')
{
  ok('열 이름 A, Z, AA, AB', columnLetter(0) === 'A' && columnLetter(25) === 'Z' && columnLetter(26) === 'AA' && columnLetter(27) === 'AB')
  ok('"L (m)" -> L, m', same(guessNameUnit('L (m)'), { name: 'L', unit: 'm' }))
  ok('"주기 [s]" -> 주기, s', same(guessNameUnit('주기 [s]'), { name: '주기', unit: 's' }))
  ok('"T" -> 이름만', same(guessNameUnit('T'), { name: 'T', unit: '' }))
  ok('공백 있는 제목은 이름을 비운다', guessNameUnit('측정 길이 (m)').name === '' && guessNameUnit('측정 길이 (m)').unit === 'm')
  ok('예약어(pi, sin)는 이름으로 안 쓴다', guessNameUnit('pi').name === '' && guessNameUnit('sin (m)').name === '')
  ok('읽을 수 없는 단위는 비운다', guessNameUnit('x (m/()').unit === '')
  ok('빈 제목', same(guessNameUnit(null), { name: '', unit: '' }))
}

console.log('\n[3] 숫자 열 찾기')
{
  const rows = [
    ['시행', 'L (m)', 'T (s)', '비고'],
    [1, 1.001, 2.006, '좋음'],
    [2, 0.998, 2.004, null],
    [3, '1.002', 2.008, '재측정'],
    [4, 'x', 2.005, ''],
  ]
  const cols = detectColumns(rows)
  ok('숫자 열 3개 (비고 열은 건너뜀)', cols.length === 3 && cols.map((c) => c.letter).join('') === 'ABC', cols.map((c) => c.letter).join(''))
  const L = cols[1]
  ok('L: 제목·단위', L.header === 'L (m)' && L.name === 'L' && L.unit === 'm')
  ok('L: 숫자 문자열도 값으로 (1.002), 값 3개', same(L.values, [1.001, 0.998, 1.002]))
  ok('L: 읽을 수 없는 칸은 skipped', same(L.skipped, ['x']))
  ok('T: 값 4개', cols[2].values.length === 4 && cols[2].skipped.length === 0)
  ok('제목 있는 1,2,3,4 열은 번호 열이 아니다', cols[0].likelyIndex === false)
  const noHead = detectColumns([[1, 5.1], [2, 5.2], [3, 5.0]])
  ok('제목 없는 1,2,3 열은 번호 열로 본다', noHead[0].likelyIndex === true && noHead[1].likelyIndex === false && noHead[1].header === null)
  ok('제목 없는 열의 값 개수 (제목이 없으면 첫 칸도 값)', noHead[1].values.length === 3)
  ok('유니코드 마이너스', same(detectColumns([['v'], ['−1.5'], ['2']])[0].values, [-1.5, 2]))
  ok('모두 글자인 표는 열이 없다', detectColumns([['a', 'b'], ['x', 'y']]).length === 0)
  ok('빈 표', detectColumns([]).length === 0)
  const withDate = detectColumns([['날짜', '값'], [new Date('2026-11-19'), 1]])
  ok('날짜 열은 숫자 열이 아니라서 건너뛴다', withDate.length === 1 && withDate[0].header === '값')
  const dateInside = detectColumns([['값'], [new Date('2026-11-19')], [5]])
  ok('값 열 안의 날짜 칸은 skipped', dateInside[0].values.length === 1 && dateInside[0].skipped[0] === '2026-11-19')
}

console.log('\n[4] 열 -> 측정 블록')
{
  const cols = detectColumns([['L (m)', 'L (cm)'], [1.0, 100], [1.1, 110]])
  const blocks = columnsToBlocks(cols.map((c) => ({ column: c, name: c.name, unit: c.unit })), ['T'])
  ok('블록 2개, 측정 블록', blocks.length === 2 && blocks.every((b) => b.type === 'measure'))
  ok('이름·단위·원문', blocks[0].name === 'L' && blocks[0].unit === 'm' && blocks[0].rawText === '1\n1.1')
  ok('같은 이름은 두 번째를 비운다', blocks[1].name === '' && blocks[1].unit === 'cm')
  const taken = columnsToBlocks([{ column: cols[0], name: 'L', unit: 'm' }], ['L'])
  ok('이미 실험에 있는 이름도 비운다', taken[0].name === '')
  ok('블록마다 id 가 다르다', blocks[0].id !== blocks[1].id)
  const s = measureStats(blocks[0])
  ok('가져온 값으로 통계가 계산된다 (평균 1.05, n=2)', s.n === 2 && Math.abs(s.mean - 1.05) < 1e-12)
}

console.log('\n[5] 엑셀 내보내기 자료')
{
  const measure = (name, rawText, typeB, unit) => ({ id: name, type: 'measure', name, unit, rawText, typeB, bFactors: [] })
  const blocks = [
    measure('L', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005', 'm'),
    measure('T', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001', 's'),
    { id: 'g', type: 'calc', name: 'g', formula: '4*pi^2*L / T^2' },
    { id: 'gr', type: 'graph', name: undefined, xName: 'L', yName: 'T', fit: 'linear' },
  ]
  const sheets = buildWorkbook(blocks, 'deg')
  ok('시트 5개 (측정, 계산, 총괄, 원본, 그래프)', same(sheets.map((s) => s.sheet), ['측정 결과', '계산 결과', '불확도 총괄표', '측정값 원본', '그래프 데이터']), sheets.map((s) => s.sheet).join())
  ok('머리글은 굵게', sheets[0].data[0][0].fontWeight === 'bold' && sheets[0].data[0][0].value === '이름')
  ok('측정 결과: n 은 숫자 칸 5', sheets[0].data[1][2] === 5)
  ok('측정 결과: 결과 글자는 그대로', sheets[0].data[1][8] === '1.0000 ± 0.0009 m', String(sheets[0].data[1][8]))
  ok('계산 결과: g = 9.811 ± 0.015 m/s²', sheets[1].data[1][2] === '9.811 ± 0.015 m/s²', String(sheets[1].data[1][2]))
  ok('측정값 원본: 머리글 L (m), T (s)', sheets[3].data[0][0].value === 'L (m)' && sheets[3].data[0][1].value === 'T (s)')
  ok('측정값 원본: 5행, 숫자 그대로', sheets[3].data.length === 6 && sheets[3].data[1][0] === 1.001 && sheets[3].data[5][1] === 2.007)
  const gd = sheets[4].data
  ok('그래프 데이터: 제목줄, 머리글, 점 5개, 추세선 줄', gd.length === 8 && gd[2][0] === 1.001 && gd[2][2] === 2.006 && String(gd[7][0]).startsWith('추세선: 직선'), JSON.stringify(gd[7]))
  const uneven = buildWorkbook([measure('a', '1\n2\n3', '', ''), measure('b', '1\n2', '', '')], 'deg').find((s) => s.sheet === '측정값 원본')
  ok('행 수가 다른 블록은 빈 칸(null)으로 채운다', uneven.data.length === 4 && uneven.data[3][1] === null)
  ok('블록이 없으면 시트도 없다', buildWorkbook([], 'deg').length === 0)
}

console.log('\n[6] .xlsx 파일로 쓰고 다시 읽기 (왕복)')
{
  const measure = (name, rawText, typeB, unit) => ({ id: name, type: 'measure', name, unit, rawText, typeB, bFactors: [] })
  const blocks = [
    measure('L', '1.001\n0.998\n1.002\n0.999\n1.000', '0.0005', 'm'),
    measure('T', '2.006\n2.004\n2.008\n2.005\n2.007', '0.001', 's'),
    { id: 'g', type: 'calc', name: 'g', formula: '4*pi^2*L / T^2' },
  ]
  const sheets = buildWorkbook(blocks, 'deg')
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ulab-')), 'out.xlsx')
  await writeExcelFile(sheets).toFile(file)
  ok('파일이 만들어졌다', fs.statSync(file).size > 500)
  const back = await readExcelFile(file)
  ok('시트 이름이 그대로', same(back.map((s) => s.sheet), sheets.map((s) => s.sheet)), back.map((s) => s.sheet).join())
  const raw = back.find((s) => s.sheet === '측정값 원본').data
  ok('원본 시트를 다시 읽으면 머리글 + 값 5개', raw.length === 6 && raw[0][0] === 'L (m)' && raw[1][0] === 1.001)
  // 내보낸 원본 시트를 다시 "가져오기" 하면 같은 측정 블록이 나온다
  const cols = detectColumns(raw)
  ok('가져오기로 열 2개를 찾는다 (L, T 이름·단위 복원)', cols.length === 2 && cols[0].name === 'L' && cols[0].unit === 'm' && cols[1].name === 'T' && cols[1].unit === 's')
  const again = columnsToBlocks(cols.map((c) => ({ column: c, name: c.name, unit: c.unit })))
  const s0 = measureStats(again[0]), o0 = measureStats(blocks[0])
  ok('왕복 후 평균·A형 불확도가 같다', s0.mean === o0.mean && s0.uA === o0.uA)
  const calcSheet = back.find((s) => s.sheet === '계산 결과').data
  ok('계산 결과 시트 값이 그대로', calcSheet[1][2] === '9.811 ± 0.015 m/s²', String(calcSheet[1][2]))
  fs.rmSync(path.dirname(file), { recursive: true, force: true })
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
