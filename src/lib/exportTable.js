// 내보내기 화면의 표를 클립보드에 넣을 형태로 바꾼다. (화면 코드와 분리한 순수 함수)
//   rows: 문자열 배열의 배열. 첫 줄이 머리글.
//   - 엑셀·구글시트에 붙여넣기: 칸은 탭(\t), 줄은 줄바꿈(\n) 으로 구분한 글자
//   - 워드·구글문서에 붙여넣기: HTML 표 (서식 있는 표로 붙는다)

// 칸 안에 탭·줄바꿈이 있으면 표 모양이 깨지므로 공백으로 바꾼다.
const clean = (cell) => String(cell ?? '').replace(/[\t\r\n]+/g, ' ')

export function tableToTsv(rows) {
  return rows.map((row) => row.map(clean).join('\t')).join('\n')
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function tableToHtml(rows) {
  const cell = (tag, c) => `<${tag} style="border:1px solid #999;padding:4px 8px">${escapeHtml(clean(c))}</${tag}>`
  const [head, ...body] = rows
  const thead = `<tr>${head.map((c) => cell('th', c)).join('')}</tr>`
  const tbody = body.map((row) => `<tr>${row.map((c) => cell('td', c)).join('')}</tr>`).join('')
  return `<table style="border-collapse:collapse">${thead}${tbody}</table>`
}
