import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExperiment } from '../lib/storage'
import { buildReport } from '../lib/report'
import { copyTable } from '../lib/exportBrowser'
import GraphView from '../components/GraphView'

// 내보내기 화면 — 보고서에 넣을 표(측정 결과, 계산 결과)와 그래프를 보여주고, 복사·저장한다.
// 표는 "표 복사"로 워드·엑셀·구글문서에 붙여넣고, 그래프는 PNG로 저장하거나 복사한다.
// 결과는 저장해 둔 것이 아니라 이 화면을 열 때마다 원본에서 새로 계산한다.
export default function ExportPage() {
  const { id } = useParams()
  const [exp, setExp] = useState(null)
  const [state, setState] = useState('loading') // 'loading' | 'ready' | 'notfound' | 'error'
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getExperiment(id)
      .then((e) => {
        if (cancelled) return
        setExp(e)
        setState(e ? 'ready' : 'notfound')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (state === 'loading') return <p className="px-6 py-12 text-center text-sm text-slate-400">불러오는 중…</p>
  if (state !== 'ready') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm">
        <p className={state === 'error' ? 'rounded-lg bg-amber-50 px-3 py-2 text-amber-800' : 'text-slate-500'}>
          {state === 'error' ? error : '실험을 찾을 수 없어요. (내 계정의 실험이 아니거나 삭제됐을 수 있어요)'}
        </p>
        <Link to="/" className="mt-3 inline-block text-slate-900 underline">
          목록으로
        </Link>
      </main>
    )
  }

  const report = buildReport(exp.blocks, exp.angleUnit)
  const hasMeasure = report.measure.length > 1
  const hasCalc = report.calc.length > 1

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to={`/exp/${id}`} className="text-sm text-slate-400 hover:text-slate-700">
        ← 편집으로
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{exp.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        보고서에 넣을 결과예요. 표는 복사해서 붙여넣고, 그래프는 이미지로 저장하세요.
      </p>

      {!hasMeasure && !hasCalc && report.graphs.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
          아직 내보낼 결과가 없어요. 편집 화면에서 측정 블록이나 계산 블록을 만들어 보세요.
        </p>
      )}

      {hasMeasure && <Section title="측정 결과" rows={report.measure} />}
      {hasCalc && <Section title="계산 결과" rows={report.calc} />}

      {report.graphs.map((g) => (
        <section key={g.id} className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-slate-900">{g.title}</h2>
          <GraphView model={g.model} />
        </section>
      ))}
    </main>
  )
}

// 표 한 개: 제목, 표 복사 버튼, 표
function Section({ title, rows }) {
  const [status, setStatus] = useState(null) // { kind, text }

  async function copy() {
    setStatus(null)
    try {
      await copyTable(rows)
      setStatus({ kind: 'ok', text: '복사했어요. 문서나 엑셀에 붙여넣으세요' })
    } catch (e) {
      setStatus({ kind: 'error', text: e.message || '복사하지 못했어요' })
    }
  }

  const [head, ...body] = rows
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <button
          onClick={copy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          표 복사
        </button>
        {status && (
          <span className={`text-xs ${status.kind === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}>{status.text}</span>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {head.map((h) => (
                <th key={h} className="border-b border-slate-200 px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {row.map((c, j) => (
                  <td key={j} className="whitespace-nowrap px-2 py-2 font-mono text-slate-800">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
