// 측정 블록 — 반복 측정값을 붙여넣으면 평균·표준편차·불확도를 계산한다. (계산은 3차시)
export default function MeasureBlock({ block, onChange }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-slate-500">이름</span>
          <input
            value={block.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="예: L"
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-slate-500">단위</span>
          <input
            value={block.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="예: m"
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-slate-500">반복 측정값 (줄바꿈이나 쉼표로 구분)</span>
        <textarea
          value={block.rawText}
          onChange={(e) => onChange({ rawText: e.target.value })}
          rows={3}
          placeholder={'1.001\n0.998\n1.002'}
          className="rounded border border-slate-300 px-2 py-1 font-mono"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-slate-500">B형 표준불확도 (기기 최소눈금 등)</span>
        <input
          value={block.typeB}
          onChange={(e) => onChange({ typeB: e.target.value })}
          placeholder="예: 0.0005"
          className="w-40 rounded border border-slate-300 px-2 py-1 font-mono"
        />
      </label>

      <p className="text-xs text-slate-400">평균·표준편차·불확도 계산은 3차시에 붙인다.</p>
    </div>
  )
}
