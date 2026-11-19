import { useMemo, useRef, useState } from 'react'
import { readTableFile } from '../lib/excelIO'
import { detectColumns, columnsToBlocks } from '../lib/excel'

// 엑셀(.xlsx)·CSV 가져오기 — 파일을 고르면 숫자가 든 열을 찾아 보여주고, 고른 열을 측정 블록으로 만든다.
// 열 제목이 "L (m)" 처럼 생겼으면 이름 L, 단위 m 으로 짐작해서 채운다 (화면에서 고칠 수 있다).
// 파일을 읽는 것은 lib/excelIO.js, 열 찾기와 블록 만들기는 lib/excel.js 가 한다.
export default function ImportPanel({ existingNames, onAdd }) {
  const [open, setOpen] = useState(false)
  const [sheets, setSheets] = useState(null) // [{ sheet, data }]
  const [sheetIdx, setSheetIdx] = useState(0)
  const [fileName, setFileName] = useState('')
  const [edits, setEdits] = useState({}) // { "시트번호:열번호": { checked, name, unit } }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const columns = useMemo(() => (sheets ? detectColumns(sheets[sheetIdx]?.data ?? []) : []), [sheets, sheetIdx])

  function reset() {
    setSheets(null); setSheetIdx(0); setFileName(''); setEdits({}); setError('')
    if (fileInput.current) fileInput.current.value = ''
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(''); setSheets(null); setEdits({})
    try {
      const result = await readTableFile(file)
      setSheets(result); setSheetIdx(0); setFileName(file.name)
    } catch (err) {
      setError(err.message || '파일을 읽지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  // 열 하나의 현재 설정: 사용자가 고친 값이 있으면 그것, 없으면 짐작한 값 (번호 열처럼 보이면 기본은 선택 안 함)
  const key = (c) => `${sheetIdx}:${c.index}`
  const get = (c) => ({ checked: !c.likelyIndex, name: c.name, unit: c.unit, ...edits[key(c)] })
  const set = (c, patch) => setEdits((prev) => ({ ...prev, [key(c)]: { ...get(c), ...patch } }))

  const chosen = columns.filter((c) => get(c).checked)

  function add() {
    const picks = chosen.map((c) => ({ column: c, name: get(c).name, unit: get(c).unit }))
    onAdd(columnsToBlocks(picks, existingNames))
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        엑셀·CSV 가져오기
      </button>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-slate-900">엑셀·CSV 가져오기</h3>
        <button onClick={() => { reset(); setOpen(false) }} className="ml-auto text-xs text-slate-400 hover:text-slate-700">
          닫기
        </button>
      </div>

      <p className="text-xs text-slate-500">
        .xlsx 또는 .csv 파일을 고르면 숫자가 든 열을 찾아서, 고른 열마다 측정 블록 하나를 만들어요. 열 맨 위 칸이 글자면 제목으로 읽어요
        (예: <span className="font-mono">L (m)</span> → 이름 L, 단위 m).
      </p>

      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,.csv,.tsv,.txt"
        onChange={onFile}
        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:text-slate-700"
      />

      {busy && <p className="text-xs text-slate-400">파일을 읽는 중…</p>}
      {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}

      {sheets && (
        <div className="space-y-3">
          {sheets.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              시트
              <select
                value={sheetIdx}
                onChange={(e) => setSheetIdx(Number(e.target.value))}
                className="rounded border border-slate-300 px-2 py-1"
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.sheet}
                  </option>
                ))}
              </select>
            </label>
          )}

          {columns.length === 0 ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              {fileName} 의 이 시트에서 숫자가 든 열을 찾지 못했어요.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">가져오기</th>
                      <th className="px-2 py-2 font-medium">열</th>
                      <th className="px-2 py-2 font-medium">이름</th>
                      <th className="px-2 py-2 font-medium">단위</th>
                      <th className="px-2 py-2 font-medium">값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((c) => {
                      const s = get(c)
                      return (
                        <tr key={c.index} className="border-t border-slate-100 align-top">
                          <td className="px-2 py-2">
                            <input type="checkbox" checked={s.checked} onChange={(e) => set(c, { checked: e.target.checked })} />
                          </td>
                          <td className="px-2 py-2 text-slate-600">
                            {c.letter}
                            {c.header && <span className="ml-1 text-slate-400">{c.header}</span>}
                            {c.likelyIndex && <div className="text-slate-400">번호 열 같아요</div>}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={s.name}
                              onChange={(e) => set(c, { name: e.target.value })}
                              placeholder="예: L"
                              className="w-20 rounded border border-slate-300 px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={s.unit}
                              onChange={(e) => set(c, { unit: e.target.value })}
                              placeholder="예: m"
                              className="w-20 rounded border border-slate-300 px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-2 font-mono text-slate-700">
                            {c.values.length}개: {c.values.slice(0, 4).join(', ')}
                            {c.values.length > 4 && ' …'}
                            {c.skipped.length > 0 && (
                              <div className="font-sans text-amber-700">
                                숫자가 아니라서 뺀 칸 {c.skipped.length}개 ({c.skipped.slice(0, 3).join(', ')}
                                {c.skipped.length > 3 && ' …'})
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={add}
                disabled={chosen.length === 0}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                측정 블록 {chosen.length}개 추가
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
