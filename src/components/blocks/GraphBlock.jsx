// 그래프 블록 — x·y축 데이터를 골라 오차막대·추세선·결정계수 그래프를 그린다. (5차시)
export default function GraphBlock({ block, namesAbove, onChange }) {
  const axisOptions = ['', ...namesAbove]
  // 골라둔 이름이 이름 바뀜/순서 바뀜으로 더 이상 위 블록에 없는지.
  const xMissing = block.xName && !namesAbove.includes(block.xName)
  const yMissing = block.yName && !namesAbove.includes(block.yName)
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
      {(xMissing || yMissing) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {xMissing && `x축 "${block.xName}"`}
          {xMissing && yMissing && ', '}
          {yMissing && `y축 "${block.yName}"`}
          {' '}이(가) 더 이상 존재하지 않아요. 이름이 바뀌었거나 블록 순서가 바뀌었을 수 있어요.
        </p>
      )}
      <p className="text-xs text-slate-400">그래프 그리기는 5차시에 만든다.</p>
    </div>
  )
}
