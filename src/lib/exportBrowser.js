// 내보내기에서 브라우저 기능(PNG 변환, 파일 저장, 클립보드)을 쓰는 부분.
// 계산이 없는 "브라우저 도우미"라서 테스트 대신 화면에서 직접 확인한다.
import { tableToHtml, tableToTsv } from './exportTable'

// SVG 그림을 PNG 파일 데이터(Blob)로 바꾼다.
// 방법: SVG 글자로 만든 뒤 <img>로 읽고, 캔버스에 그려서 PNG로 뽑는다.
// scale 2 = 가로세로 2배 해상도로 뽑아서 보고서에 넣어도 선명하게 한다.
export async function svgToPngBlob(svg, scale = 2) {
  const box = svg.viewBox.baseVal
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(box.width))
  clone.setAttribute('height', String(box.height))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = box.width * scale
    canvas.height = box.height * scale
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, box.width, box.height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG로 바꾸지 못했어요'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 파일로 저장(다운로드)한다. 보이지 않는 링크를 만들어 눌러서 브라우저의 저장 기능을 쓴다.
export function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// 이미지를 클립보드에 복사한다 (워드·문서에 바로 붙여넣기). 브라우저가 막으면 오류를 던진다.
export async function copyImage(blob) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('이 브라우저는 이미지 복사를 지원하지 않아요. "이미지 저장"을 쓰세요')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

// 표를 클립보드에 복사한다. 서식 있는 표(HTML)와 탭으로 구분한 글자를 함께 넣어서
// 워드·구글문서에는 표로, 엑셀·메모장에는 칸으로 나뉜 글자로 붙는다.
export async function copyTable(rows) {
  const tsv = tableToTsv(rows)
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([tableToHtml(rows)], { type: 'text/html' }),
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
      }),
    ])
    return
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(tsv)
    return
  }
  throw new Error('이 브라우저는 복사를 지원하지 않아요')
}
