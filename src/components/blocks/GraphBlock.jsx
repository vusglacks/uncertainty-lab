// 그래프 블록 — x·y축 데이터를 골라 오차막대·추세선·결정계수 그래프를 그린다. (5차시)
export default function GraphBlock({ block, namesAbove, onChange }) {
  const axisOptions = ['', ...namesAbove]
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">x축</span>
          <select
            value={block.xName}
            onChange={(e) => onChange({ xName: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {axisOptions.map((n) => (
              <option key={n} value={n}>
                {n || '선택'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">y축</span>
          <select
            value={block.yName}
            onChange={(e) => onChange({ yName: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {axisOptions.map((n) => (
              <option key={n} value={n}>
                {n || '선택'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">추세선</span>
          <select
            value={block.fit}
            onChange={(e) => onChange({ fit: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1"
          >
            <option value="linear">직선</option>
            <option value="none">없음</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-400">그래프 그리기는 5차시에 만든다.</p>
    </div>
  )
}
