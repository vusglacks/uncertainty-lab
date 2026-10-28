import GraphView from '../GraphView'
import { buildGraph } from '../../lib/graph'
import { FIT_LABELS } from '../../lib/regression'

// 그래프 블록 — x축·y축 측정 블록을 고르면 오차막대·추세선·결정계수가 있는 그래프를 그린다.
// 점은 두 블록의 "같은 순서의 값"끼리 짝지어 만든다. 계산은 lib/graph.js, lib/regression.js.
export default function GraphBlock({ block, namesAbove, blocksAbove, onChange }) {
  // 축으로 고를 수 있는 것: 위쪽의 측정 블록 이름 (여러 값을 가진 블록만 점이 된다)
  const axisOptions = [
    '',
    ...new Set(blocksAbove.filter((b) => b.type === 'measure' && b.name && b.name.trim()).map((b) => b.name)),
  ]
  // 골라둔 이름이 이름 바뀜/순서 바뀜으로 더 이상 위 블록에 없는지.
  const xMissing = block.xName && !namesAbove.includes(block.xName)
  const yMissing = block.yName && !namesAbove.includes(block.yName)
  const model = buildGraph(block, blocksAbove)

  const select = (label, field) => (
    <label className="flex flex-col gap-1">
      <span className="text-slate-500">{label}</span>
      <select
        value={block[field]}
        onChange={(e) => onChange({ [field]: e.target.value })}
        className="rounded border border-slate-300 px-2 py-1"
      >
        {axisOptions.map((n) => (
          <option key={n} value={n}>
            {n || '선택'}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3">
        {select('x축', 'xName')}
        {select('y축', 'yName')}
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">추세선</span>
          <select
            value={block.fit}
            onChange={(e) => onChange({ fit: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {Object.entries(FIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(xMissing || yMissing) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {xMissing && `x축 "${block.xName}"`}
          {xMissing && yMissing && ', '}
          {yMissing && `y축 "${block.yName}"`}
          {' '}이(가) 더 이상 존재하지 않아요. 이름이 바뀌었거나 블록 순서가 바뀌었을 수 있어요.
        </p>
      )}

      <GraphView model={model} />

      <p className="text-xs text-slate-400">
        점은 x축·y축 블록의 같은 순서 값끼리 짝지어요. 오차막대는 각 블록의 B형 불확도예요.
      </p>
    </div>
  )
}
