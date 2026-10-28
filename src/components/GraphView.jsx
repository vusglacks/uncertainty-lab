import { useRef, useState } from 'react'
import Chart from './Chart'
import { formatResult } from '../lib/engine'
import { formatNumber } from '../lib/stats'
import { FIT_LABELS } from '../lib/regression'
import { copyImage, downloadBlob, svgToPngBlob } from '../lib/exportBrowser'

// 그래프 하나를 보여준다: 그림 + 추세선 요약 + 이미지 저장·복사 버튼.
// 편집 화면의 그래프 블록과 내보내기 화면이 함께 쓴다. model 은 lib/graph.js 의 buildGraph 결과.
export default function GraphView({ model }) {
  const svgRef = useRef(null)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'error', text }

  if (!model.ok) {
    if (model.empty) return <p className="text-xs text-slate-400">{model.message}</p>
    return <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">그릴 수 없어요: {model.message}</p>
  }

  const { fit, points } = model
  // 값 ± 표준오차는 유효숫자 규칙으로, 표준오차가 없으면(점 2개) 그냥 값만
  const withErr = (v, e) => (e === null ? formatNumber(v) : formatResult(v, e).text)

  async function run(action, doneText) {
    setStatus(null)
    try {
      const blob = await svgToPngBlob(svgRef.current)
      await action(blob)
      setStatus({ kind: 'ok', text: doneText })
    } catch (e) {
      setStatus({ kind: 'error', text: e.message || '실패했어요' })
    }
  }
  const fileName = `${model.yName}-${model.xName}.png`.replace(/[^\w가-힣.-]+/g, '_')

  return (
    <div className="space-y-2">
      <Chart model={model} svgRef={svgRef} />

      <p className="text-xs text-slate-500">
        점 {points.length}개
        {model.hasXErr || model.hasYErr
          ? ` · 오차막대: ${[model.hasXErr && 'x축 B형 불확도', model.hasYErr && 'y축 B형 불확도'].filter(Boolean).join(', ')}`
          : ' · 오차막대를 보려면 측정 블록에 B형 불확도를 입력하세요'}
      </p>

      {fit && (
        <p className="font-mono text-xs text-slate-700">
          추세선: {FIT_LABELS[fit.type]} · {fit.params.map((p) => `${p.label} = ${withErr(p.value, p.err)}`).join(' · ')}
          {fit.r2 !== null && ` · R² = ${Number(fit.r2.toPrecision(4))}`}
        </p>
      )}
      {model.fitMessage && <p className="text-xs text-slate-400">{model.fitMessage}</p>}
      {model.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {w}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => run((b) => downloadBlob(b, fileName), '이미지를 저장했어요')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        >
          이미지 저장 (PNG)
        </button>
        <button
          onClick={() => run(copyImage, '이미지를 복사했어요. 문서에 붙여넣으세요')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
        >
          이미지 복사
        </button>
        {status && (
          <span className={status.kind === 'ok' ? 'text-emerald-700' : 'text-amber-700'}>{status.text}</span>
        )}
      </div>
    </div>
  )
}
