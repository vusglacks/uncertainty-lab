import { B_KINDS, DEFAULT_K, formatNumber } from '../lib/stats'
import { uid } from '../lib/id'

// B형 요인 입력: 분해능, 기기 오차한계, 교정 확장불확도 등을 따로 넣으면
// 요인마다 표준불확도 u 로 바꿔서 √(Σu²) 로 합친다. (환산식은 lib/stats.js 의 B_KINDS)
//   factors: block.bFactors (입력한 글자 그대로)   parsed: measureStats 가 계산한 요인별 u 목록
export default function BFactorsEditor({ factors, parsed, onChange }) {
  const kindOf = (id) => B_KINDS.find((k) => k.id === id) ?? B_KINDS[0]
  const update = (id, patch) => onChange(factors.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const add = () => onChange([...factors, { id: uid(), label: '', kind: 'resolution', value: '', k: '' }])
  const remove = (id) => onChange(factors.filter((f) => f.id !== id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">
          B형 요인 <span className="text-xs text-slate-400">— 분해능·기기 오차 등을 나눠 넣으면 합성해서 B형으로 써요</span>
        </span>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + 요인 추가
        </button>
      </div>

      {factors.map((f) => {
        const kind = kindOf(f.kind)
        const u = parsed.find((p) => p.id === f.id)
        return (
          <div key={f.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-400">요인 이름</span>
              <input
                value={f.label}
                onChange={(e) => update(f.id, { label: e.target.value })}
                placeholder="예: 눈금 읽기"
                className="w-28 rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-400">종류</span>
              <select
                value={f.kind}
                onChange={(e) => update(f.id, { kind: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1"
              >
                {B_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-slate-400">{kind.valueLabel}</span>
              <input
                value={f.value}
                onChange={(e) => update(f.id, { value: e.target.value })}
                placeholder="예: 0.01"
                className="w-24 rounded border border-slate-300 px-2 py-1 font-mono"
              />
            </label>
            {f.kind === 'ext' && (
              <label className="flex flex-col gap-0.5">
                <span className="text-slate-400">포함인자 k</span>
                <input
                  value={f.k ?? ''}
                  onChange={(e) => update(f.id, { k: e.target.value })}
                  placeholder={String(DEFAULT_K)}
                  className="w-16 rounded border border-slate-300 px-2 py-1 font-mono"
                />
              </label>
            )}
            <span className="pb-1 font-mono text-slate-600">
              {kind.formula}
              {u?.used && <span className="font-semibold text-slate-900"> = {formatNumber(u.u)}</span>}
            </span>
            <button
              type="button"
              onClick={() => remove(f.id)}
              title="요인 삭제"
              className="ml-auto px-1 pb-1 text-slate-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
