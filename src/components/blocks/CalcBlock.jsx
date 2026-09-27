import { unknownFormulaVars } from '../../lib/blocks'

// 계산 블록 — 수식을 입력한다. 위 블록의 이름을 변수로 쓴다. (미분·오차 전파는 4차시)
export default function CalcBlock({ block, namesAbove, onChange }) {
  const unknown = unknownFormulaVars(block.formula, namesAbove)
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">이름</span>
          <input
            value={block.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="예: g"
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-slate-500">수식</span>
          <input
            value={block.formula}
            onChange={(e) => onChange({ formula: e.target.value })}
            placeholder="예: 4*pi^2*L / T^2"
            className="rounded border border-slate-300 px-2 py-1 font-mono"
          />
        </label>
      </div>

      <p className="text-xs text-slate-400">
        쓸 수 있는 변수:{' '}
        {namesAbove.length ? (
          <span className="font-mono text-slate-600">{namesAbove.join(', ')}</span>
        ) : (
          '없음 (위에 이름 있는 블록을 먼저 만드세요)'
        )}
      </p>
      {unknown.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          존재하지 않는 이름이에요: {unknown.join(', ')} — 이름이 바뀌었거나 블록 순서가 바뀌었을 수 있어요.
        </p>
      )}
      <p className="text-xs text-slate-400">자동 미분·오차 전파는 4차시에 engine.js를 연결한다.</p>
    </div>
  )
}
