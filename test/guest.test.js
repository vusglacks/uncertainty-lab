import { createGuestStorage } from '../src/lib/guestStorage.js'

let pass = 0, fail = 0
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label} ${detail}`) }
}
// localStorage 와 같은 모양의 가짜 저장소
function fakeStore(initial = {}, { full = false } = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); m.set(k, v) },
    raw: m,
  }
}
const KEY = 'uncertainty-lab:experiments'
const exp = (id, title, extra = {}) => ({ id, title, angleUnit: 'deg', blocks: [], ...extra })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('\n[1] 저장·불러오기·삭제')
{
  const g = createGuestStorage(fakeStore())
  ok('처음엔 빈 목록', (await g.listExperiments()).length === 0)
  await g.saveExperiment(exp('a', '실험 A', { blocks: [{ id: 'b1', type: 'measure', name: 'L' }] }))
  const a = await g.getExperiment('a')
  ok('저장한 실험을 불러온다', a.title === '실험 A' && a.blocks[0].name === 'L' && a.angleUnit === 'deg')
  ok('만든·수정 시각이 채워진다', typeof a.createdAt === 'string' && typeof a.updatedAt === 'string' && !isNaN(new Date(a.updatedAt)))
  const created = a.createdAt
  await wait(5)
  await g.saveExperiment({ ...a, title: '실험 A (수정)' })
  const a2 = await g.getExperiment('a')
  ok('같은 id 로 저장하면 덮어쓴다 (복사본이 생기지 않는다)', (await g.listExperiments()).length === 1 && a2.title === '실험 A (수정)')
  ok('덮어써도 만든 시각은 그대로, 수정 시각은 새로', a2.createdAt === created && a2.updatedAt > created)
  ok('없는 id 는 null', (await g.getExperiment('zzz')) === null)
  await g.deleteExperiment('a')
  ok('삭제', (await g.listExperiments()).length === 0)
  await g.deleteExperiment('없음')
  ok('없는 것을 지워도 오류 없음', true)
}

console.log('\n[2] 목록 순서 (최근 수정순)')
{
  const g = createGuestStorage(fakeStore())
  await g.saveExperiment(exp('1', '첫째')); await wait(5)
  await g.saveExperiment(exp('2', '둘째')); await wait(5)
  await g.saveExperiment(exp('3', '셋째')); await wait(5)
  await g.saveExperiment(exp('1', '첫째 수정'))
  ok('수정한 것이 맨 위', (await g.listExperiments()).map((e) => e.id).join() === '1,3,2')
}

console.log('\n[3] 예전 형식·깨진 자료에 강하다')
{
  const old = [{ id: 'o1', title: '옛 실험', blocks: [{ id: 'x', type: 'calc', name: 'g', formula: '1' }] }, { id: 'o2', angleUnit: 'rad' }]
  const g = createGuestStorage(fakeStore({ [KEY]: JSON.stringify(old) }))
  const list = await g.listExperiments()
  ok('빠진 칸은 기본값으로 (각도 deg, 시각 문자열)', list.length === 2 && list.every((e) => ['deg', 'rad'].includes(e.angleUnit) && typeof e.updatedAt === 'string' && Array.isArray(e.blocks)))
  ok('rad 는 유지, 제목 없으면 빈 글자', list.find((e) => e.id === 'o2').angleUnit === 'rad' && list.find((e) => e.id === 'o2').title === '')
  const broken = createGuestStorage(fakeStore({ [KEY]: '{깨짐' }))
  ok('깨진 JSON 은 빈 목록', (await broken.listExperiments()).length === 0)
  const notArray = createGuestStorage(fakeStore({ [KEY]: '{"a":1}' }))
  ok('배열이 아니면 빈 목록', (await notArray.listExperiments()).length === 0)
  await g.saveExperiment(exp('o1', '옛 실험 수정'))
  ok('옛 실험을 저장해도 다른 실험은 그대로', (await g.listExperiments()).length === 2)
}

console.log('\n[4] 예전 "가져오기"와 같은 저장 위치')
{
  const store = fakeStore()
  const g = createGuestStorage(store)
  await g.saveExperiment(exp('k', '키 확인', { blocks: [{ id: 'b', type: 'measure', name: 'L', unit: 'm', rawText: '1\n2', typeB: '', bFactors: [] }] }))
  const raw = JSON.parse(store.raw.get(KEY))
  ok('키가 localImport.js 와 같다', Array.isArray(raw) && raw[0].id === 'k')
  ok('원본(블록)만 저장된다 — 계산 결과 칸이 없다', !JSON.stringify(raw).includes('uncertainty') && !('result' in raw[0]))
  ok('가져오기가 읽는 필드(title, angleUnit, blocks)가 있다', raw[0].title === '키 확인' && raw[0].angleUnit === 'deg' && raw[0].blocks.length === 1)
}

console.log('\n[5] 저장 공간이 없을 때')
{
  const g = createGuestStorage(fakeStore({}, { full: true }))
  let msg = ''
  try { await g.saveExperiment(exp('x', 'x')) } catch (e) { msg = e.message }
  ok('저장 실패는 한국어 오류로 알린다', msg.includes('저장하지 못했어요'), msg)
}

console.log(`\n결과: ${pass}개 통과, ${fail}개 실패\n`)
process.exit(fail === 0 ? 0 : 1)
