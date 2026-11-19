// ============================================================
//  엑셀·CSV 가져오기와 엑셀(.xlsx) 내보내기의 "자료 만들기" 부분 (화면·파일 입출력과 분리한 순수 함수)
//
//  파일을 실제로 읽고 쓰는 일(브라우저의 파일 선택·다운로드)은 excelIO.js 가 하고,
//  여기서는 표 모양의 자료(2차원 배열)를 다룬다. 그래서 node 로 바로 테스트할 수 있다.
//
//  가져오기: 표(2차원 배열) -> 열 찾기(detectColumns) -> 측정 블록(columnsToBlocks)
//  내보내기: 실험 -> 시트 여러 개(buildWorkbook) -> excelIO.js 가 .xlsx 파일로 저장
// ============================================================
import { newBlock } from './blocks.js'
import { measureStats } from './stats.js'
import { buildReport } from './report.js'
import { FIT_LABELS } from './regression.js'
import { FUNCTION_GROUPS, CONSTANTS } from './functions.js'
import { parseUnit } from './units.js'

// 숫자 모양 글자만 숫자로 본다 (stats.js 의 parseValues 와 같은 규칙)
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
const isNumericText = (s) => NUMBER_RE.test(String(s).trim().replace(/−/g, '-'))

// =============================================================
//  가져오기
// =============================================================

// CSV/TSV 글자를 표(2차원 배열)로 바꾼다.
//   - 구분자는 첫 줄을 보고 고른다: 탭, 세미콜론, 쉼표 중 가장 많이 나온 것
//   - 큰따옴표로 감싼 칸 안의 구분자·줄바꿈·"" (따옴표 하나) 를 처리한다
//   - 맨 앞의 BOM(엑셀이 붙이는 보이지 않는 표시)은 지운다
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const firstLine = src.split(/\r\n|\n|\r/, 1)[0] ?? ''
  const count = (ch) => firstLine.split(ch).length - 1
  const delim = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0]
  const sep = delim[1] > 0 ? delim[0] : ','

  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ }
        else quoted = false
      } else cell += c
    } else if (c === '"' && cell === '') {
      quoted = true
    } else if (c === sep) {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  // 맨 끝의 완전히 빈 줄은 버린다
  while (rows.length && rows[rows.length - 1].every((c) => String(c).trim() === '')) rows.pop()
  return rows
}

// 열 번호(0부터) -> 엑셀 열 이름 (0 -> A, 25 -> Z, 26 -> AA)
export function columnLetter(index) {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

const RESERVED = new Set([...FUNCTION_GROUPS.flatMap((g) => g.names), ...CONSTANTS])
const NAME_RE = /^[A-Za-z_가-힣][A-Za-z0-9_가-힣]*$/

// 열 제목에서 이름과 단위를 짐작한다.
//   "L (m)" -> 이름 L, 단위 m      "주기 [s]" -> 이름 주기, 단위 s
//   수식에서 변수로 쓸 수 없는 제목(공백이 있거나 pi 같은 예약어)은 이름을 비워 둔다. 하율이 직접 채우면 된다.
export function guessNameUnit(header) {
  const h = String(header ?? '').trim()
  if (!h) return { name: '', unit: '' }
  const m = h.match(/^(.*?)\s*[([（]([^)\]）]+)[)\]）]\s*$/)
  const label = (m ? m[1] : h).trim()
  let unit = m ? m[2].trim() : ''
  if (unit && !parseUnit(unit).ok) unit = ''
  const name = NAME_RE.test(label) && !RESERVED.has(label) ? label : ''
  return { name, unit }
}

// 표에서 "숫자가 든 열"을 찾는다.
//   rows: 2차원 배열. 칸은 숫자 / 글자 / null / Date 등 (엑셀) 또는 글자 (CSV)
// 열마다: 맨 위 비어 있지 않은 칸이 숫자가 아닌 글자면 제목으로 보고 나머지를 값으로 읽는다.
//   숫자로 읽을 수 없는 칸은 skipped 에 모아 화면에서 알려준다.
//   숫자가 하나도 없는 열(글자 열)은 건너뛴다.
// 반환: [{ index, letter, header, name, unit, values:[숫자], skipped:[글자], likelyIndex }]
//   likelyIndex: 제목 없이 1,2,3… 으로 늘어나는 번호 열 같으면 true (기본으로 선택하지 않는다)
export function detectColumns(rows) {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0)
  const cols = []
  for (let c = 0; c < width; c++) {
    const cells = rows.map((r) => r[c])
    const blank = (x) => x === null || x === undefined || (typeof x === 'string' && x.trim() === '')
    let start = cells.findIndex((x) => !blank(x))
    if (start < 0) continue

    let header = null
    const first = cells[start]
    if (typeof first === 'string' && !isNumericText(first)) {
      header = first.trim()
      start++
    }

    const values = []
    const skipped = []
    for (let i = start; i < cells.length; i++) {
      const x = cells[i]
      if (blank(x)) continue
      if (typeof x === 'number' && Number.isFinite(x)) values.push(x)
      else if (typeof x === 'string' && isNumericText(x)) values.push(Number(x.trim().replace(/−/g, '-')))
      else skipped.push(x instanceof Date ? x.toISOString().slice(0, 10) : String(x))
    }
    if (values.length === 0) continue

    const { name, unit } = guessNameUnit(header)
    const likelyIndex = header === null && values.length >= 2 && values.every((v, i) => v === i + 1)
    cols.push({ index: c, letter: columnLetter(c), header, name, unit, values, skipped, likelyIndex })
  }
  return cols
}

// 고른 열들을 측정 블록으로 만든다.
//   picks: [{ column, name, unit }]  (name, unit 은 화면에서 고친 값)
//   takenNames: 이미 실험에 있는 이름들. 겹치는 이름은 비워 둔다 (편집 화면의 "이름 겹침" 경고를 막으려고)
// 측정값은 rawText 에 줄바꿈으로 이어 붙인다. 불러온 숫자를 그대로(글자 그대로 쓴 12.30 같은 끝자리 0은 없어진다).
export function columnsToBlocks(picks, takenNames = []) {
  const used = new Set(takenNames.map((n) => String(n).trim()).filter(Boolean))
  return picks.map(({ column, name, unit }) => {
    const b = newBlock('measure')
    let nm = String(name ?? '').trim()
    if (nm && used.has(nm)) nm = ''
    if (nm) used.add(nm)
    b.name = nm
    b.unit = String(unit ?? '').trim()
    b.rawText = column.values.map((v) => String(v)).join('\n')
    return b
  })
}

// =============================================================
//  내보내기
// =============================================================

const bold = (value) => ({ value, fontWeight: 'bold' })

// 표(글자 2차원 배열, 첫 줄은 머리글) -> 시트 자료. 숫자 모양 글자는 숫자 칸으로 바꾼다.
// 단, "1.0000 ± 0.0009 m" 처럼 섞인 글자는 그대로 둔다 (유효숫자 끝자리 0이 사라지면 안 되므로).
function tableToSheetData(rows) {
  const [head, ...body] = rows
  return [
    head.map(bold),
    ...body.map((row) => row.map((c) => (typeof c === 'string' && NUMBER_RE.test(c.trim()) ? Number(c) : c))),
  ]
}

const widths = (...ws) => ws.map((width) => ({ width }))

// 실험 -> 엑셀 시트 목록 [{ sheet, data, columns }]
//   측정 결과 / 계산 결과 / 불확도 총괄표 : 내보내기 화면의 표와 같은 내용
//   측정값 원본 : 측정 블록마다 한 열, 입력한 측정값 그대로 (엑셀에서 다시 계산해 볼 수 있게)
//   그래프 데이터 : 그래프마다 x, u(x), y, u(y) 와 추세선 정보
// 결과를 저장해 둔 것이 아니라 원본에서 새로 계산한 값이다 (report.js 와 같은 방식).
export function buildWorkbook(blocks, angleUnit) {
  const report = buildReport(blocks, angleUnit)
  const sheets = []

  if (report.measure.length > 1) {
    sheets.push({ sheet: '측정 결과', data: tableToSheetData(report.measure), columns: widths(10, 8, 12, 12, 12, 12, 12, 12, 26), stickyRowsCount: 1 })
  }
  if (report.calc.length > 1) {
    sheets.push({ sheet: '계산 결과', data: tableToSheetData(report.calc), columns: widths(10, 28, 32, 28), stickyRowsCount: 1 })
  }
  if (report.summary.length > 1) {
    sheets.push({ sheet: '불확도 총괄표', data: tableToSheetData(report.summary), columns: widths(12, 12, 12, 12, 30, 12, 14, 10), stickyRowsCount: 1 })
  }

  // 측정값 원본: 열 = 측정 블록
  const measures = blocks.filter((b) => b.type === 'measure')
  if (measures.length) {
    const stats = measures.map((b) => measureStats(b))
    const nMax = Math.max(...stats.map((s) => s.n), 0)
    const head = measures.map((b, i) => bold(`${b.name || `블록${i + 1}`}${b.unit ? ` (${b.unit})` : ''}`))
    const body = []
    for (let r = 0; r < nMax; r++) body.push(stats.map((s) => (r < s.n ? s.values[r] : null)))
    sheets.push({ sheet: '측정값 원본', data: [head, ...body], columns: widths(...measures.map(() => 14)), stickyRowsCount: 1 })
  }

  // 그래프 데이터: 그래프마다 위에서 아래로 쌓는다
  const graphs = report.graphs.filter((g) => g.model.ok)
  if (graphs.length) {
    const data = []
    graphs.forEach((g, gi) => {
      const m = g.model
      if (gi > 0) data.push([null])
      data.push([bold(g.title), `x: ${m.xLabel}`, `y: ${m.yLabel}`])
      data.push([bold(`x (${m.xLabel})`), bold('u(x)'), bold(`y (${m.yLabel})`), bold('u(y)')])
      for (const p of m.points) data.push([p.x, p.ux, p.y, p.uy])
      if (m.fit) {
        const params = m.fit.params.map((p) => `${p.label} = ${Number(p.value.toPrecision(6))}`).join(', ')
        data.push([`추세선: ${FIT_LABELS[m.fit.type]}`, params, m.fit.r2 === null ? 'R² 없음' : `R² = ${Number(m.fit.r2.toPrecision(6))}`])
      }
    })
    sheets.push({ sheet: '그래프 데이터', data, columns: widths(24, 24, 24, 14) })
  }
  return sheets
}
