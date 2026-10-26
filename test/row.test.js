import { rowToExperiment, experimentToRow } from '../src/lib/experimentRow.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}

const blocks = [
  { id: 'b1', type: 'measure', name: 'L', unit: 'm', rawText: '1.001\t0.998\r\n1.002', typeB: '0.0005' },
  { id: 'b2', type: 'calc', name: 'g', formula: '4*pi^2*L / T^2' },
]

console.log('\n[1] 앱 객체 → DB 한 줄')
{
  const exp = { id: 'e1', title: '단진자', angleUnit: 'rad', blocks, createdAt: 'x', updatedAt: 'y' }
  const row = experimentToRow(exp, new Date('2026-10-26T00:00:00Z'))
  ok('이름 규칙 변환(angleUnit → angle_unit)', row.angle_unit === 'rad' && !('angleUnit' in row))
  ok('블록 원문 그대로 (엑셀 탭·CRLF 보존)', JSON.stringify(row.blocks) === JSON.stringify(blocks))
  ok('수정 시각은 저장 시점으로', row.updated_at === '2026-10-26T00:00:00.000Z')
  ok('user_id 는 보내지 않음 (DB가 로그인한 사용자로 채움)', !('user_id' in row))
  ok('만든 시각은 보내지 않음 (DB 기본값 유지)', !('created_at' in row))
}

console.log('\n[2] DB 한 줄 → 앱 객체')
{
  const row = {
    id: 'e1', user_id: 'u1', title: '단진자', angle_unit: 'deg', blocks,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
  }
  const exp = rowToExperiment(row)
  ok('필드 변환', exp.angleUnit === 'deg' && exp.createdAt === row.created_at && exp.updatedAt === row.updated_at)
  ok('user_id 는 앱 객체에 넣지 않음', !('user_id' in exp) && !('userId' in exp))
  ok('blocks 가 비어 있으면 빈 배열', rowToExperiment({ ...row, blocks: null }).blocks.length === 0)
  const back = experimentToRow(exp, new Date('2026-10-26T00:00:00Z'))
  ok('왕복해도 내용이 같다', back.title === row.title && JSON.stringify(back.blocks) === JSON.stringify(blocks))
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
