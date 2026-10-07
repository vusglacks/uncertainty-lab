import { measureStats, formatNumber } from '../../lib/stats'
import { formatResult } from '../../lib/engine'

// 측정 블록 — 반복 측정값을 붙여넣으면 평균·표준편차·A형 불확도를 계산해 보여준다.
// 계산은 lib/stats.js 의 함수들이 하고, 이 파일은 입력칸과 결과 표시만 맡는다.
export default function MeasureBlock({ block, onChange }) {
  const s = measureStats(block)

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
        <span className="text-slate-500">반복 측정값 (엑셀에서 복사해 붙여넣기 · 줄바꿈/탭/쉼표로 구분)</span>
        <textarea
          value={block.rawText}
          onChange={(e) => onChange({ rawText: e.target.value })}
          rows={3}
          placeholder={'1.001\n0.998\n1.002'}
          className="rounded border border-slate-300 px-2 py-1 font-mono"
        />
      </label>

      {s.invalid.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          숫자가 아니라서 계산에서 뺐어요: {s.invalid.join(', ')}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-slate-500">B형 표준불확도 (기기 최소눈금 등, 없으면 비워두기)</span>
        <input
          value={block.typeB}
          onChange={(e) => onChange({ typeB: e.target.value })}
          placeholder="예: 0.0005"
          className="w-40 rounded border border-slate-300 px-2 py-1 font-mono"
        />
      </label>

      {s.typeBError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{s.typeBError}</p>
      )}

      {s.n === 0 ? (
        <p className="text-xs text-slate-400">측정값을 붙여넣으면 평균과 불확도가 여기에 나와요.</p>
      ) : (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <Row label="측정 횟수 n" value={s.n} />
            <Row label="평균" value={formatNumber(s.mean)} unit={block.unit} />
            <Row
              label="표준편차 s (n−1)"
              value={s.std === null ? '2개 이상 필요' : formatNumber(s.std)}
              unit={s.std === null ? '' : block.unit}
            />
            <Row
              label="A형 u_A = s/√n"
              value={s.uA === null ? '2개 이상 필요' : formatNumber(s.uA)}
              unit={s.uA === null ? '' : block.unit}
            />
            {s.uBGiven && <Row label="B형 u_B" value={formatNumber(s.uB)} unit={block.unit} />}
            {s.uC !== null && (
              <Row label="합성 u_c = √(u_A²+u_B²)" value={formatNumber(s.uC)} unit={block.unit} strong />
            )}
          </dl>

          {s.uC !== null ? (
            <p className="border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
              {block.name ? `${block.name} = ` : ''}
              {formatResult(s.mean, s.uC).text}
              {block.unit ? ` ${block.unit}` : ''}
            </p>
          ) : (
            !s.typeBError && (
              <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                측정값이 1개라 A형을 계산할 수 없어요. B형 불확도를 입력하거나 2개 이상 측정하세요.
              </p>
            )
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, unit, strong }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-mono ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value}
        {unit ? ` ${unit}` : ''}
      </dd>
    </>
  )
}
