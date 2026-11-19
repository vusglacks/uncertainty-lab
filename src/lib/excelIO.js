// 엑셀·CSV 파일을 실제로 읽고 쓰는 부분 (브라우저 기능). 계산이 없는 "파일 도우미"라서 화면에서 직접 확인한다.
// 표 자료를 다루는 계산·정리는 excel.js 가 한다.
//
// 라이브러리(read-excel-file, write-excel-file)는 엑셀 파일(.xlsx)의 압축을 풀고 묶는 "파일 입출력"만 맡는다.
// 불확도 계산과는 상관이 없어서 외부 라이브러리를 써도 된다. 쓸 때만 내려받도록 import() 로 늦게 불러온다.
import { parseCsv } from './excel'
import { downloadBlob } from './exportBrowser'

// 파일 하나를 읽어 시트 목록 [{ sheet: 시트 이름, data: 2차원 배열 }] 로 돌려준다.
//   .xlsx : 모든 시트
//   .csv .tsv .txt : 시트 하나
export async function readTableFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const { default: readExcelFile } = await import('read-excel-file/browser')
    return await readExcelFile(file)
  }
  if (/\.(csv|tsv|txt)$/.test(name)) {
    return [{ sheet: file.name, data: parseCsv(await file.text()) }]
  }
  if (name.endsWith('.xls')) {
    throw new Error('예전 형식(.xls)은 읽을 수 없어요. 엑셀에서 "다른 이름으로 저장"으로 .xlsx 나 .csv 로 저장해서 올려주세요')
  }
  throw new Error('.xlsx, .csv, .tsv, .txt 파일만 가져올 수 있어요')
}

// 시트 목록(excel.js 의 buildWorkbook 결과)을 .xlsx 파일로 저장(다운로드)한다.
export async function saveWorkbook(sheets, filename) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const blob = await writeExcelFile(sheets).toBlob()
  downloadBlob(blob, filename)
}
