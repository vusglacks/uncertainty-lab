import { unknownFormulaVars } from '../../lib/blocks'
import { evaluateCalc, evaluateRows } from '../../lib/calc'
import { formatResult } from '../../lib/engine'
import { formatNumber } from '../../lib/stats'
import ExplainTable from '../ExplainTable'
import { FUNCTION_GROUPS, FUNCTION_SUMMARY } from '../../lib/functions'

// 행별 값 목록에서 화면에 보여줄 최대 행 수 (나머지는 "…"로 줄인다)
const MAX_SHOWN_ROWS = 12

// 계산 블록 — 수식을 입력하면 위쪽 측정 블록의 평균·합성불확도로 값과 불확도를 계산한다.
// 수식에는 위쪽 측정 블록과 계산 블록의 이름을 쓸 수 있다 (계산 블록은 그 식으로 펼쳐서 계산).
// 값 하나 말고, 측정값을 행별로 계산한 값 목록도 만들어 그래프 축으로 쓴다.
// 계산은 lib/calc.js (engine.js 연결부)가 하고, 이 파일은 입력칸과 결과 표시만 맡는다.
export default function CalcBlock({ block, namesAbove, blocksAbove, angleUnit, onChange }) {
  const unknown = unknownFormulaVars(block.formula, namesAbove)
  const result = evaluateCalc(block.formula, blocksAbove, angleUnit)
  const rows = evaluateRows(block.formula, blocksAbove, angleUnit)
  const topShare = result.ok ? Math.max(...result.terms.map((t) => t.share), 0) : 0

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

      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer select-none">{FUNCTION_SUMMARY}</summary>
        <ul className="mt-1 space-y-0.5 pl-4">
          {FUNCTION_GROUPS.map((g) => (
            <li key={g.title}>
              <span className="text-slate-500">{g.title}</span>{' '}
              <span className="font-mono text-slate-600">{g.names.join(' ')}</span>
              {g.note && <span> — {g.note}</span>}
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-slate-400">
        쓸 수 있는 변수:{' '}
        {namesAbove.length ? (
          <span className="font-mono text-slate-600">{namesAbove.join(', ')}</span>
        ) : (
          '없음 (위에 이름 있는 측정 블록을 먼저 만드세요)'
        )}
      </p>
      {unknown.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          존재하지 않는 이름이에요: {unknown.join(', ')} — 이름이 바뀌었거나 블록 순서가 바뀌었을 수 있어요.
        </p>
      )}

      {result.empty && (
        <p className="text-xs text-slate-400">수식을 입력하면 값과 불확도가 여기에 나와요.</p>
      )}

      {result.ok === false && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          계산할 수 없어요: {result.message}
        </p>
      )}

      {result.ok && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-base font-semibold text-slate-900">
            {block.name ? `${block.name} = ` : ''}
            {result.text}
          </p>

          {result.terms.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500">변수별 오차 기여도</p>
              {topShare === 0 ? (
                <p className="text-xs text-slate-400">모든 변수의 불확도가 0이라 기여도를 나눌 수 없어요.</p>
              ) : (
                result.terms.map((t) => {
                  const isTop = t.share === topShare
                  return (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0 truncate font-mono text-slate-700" title={t.name}>
                        {t.name}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-slate-200">
                        <div
                          className={`h-3 rounded ${isTop ? 'bg-sky-500' : 'bg-slate-400'}`}
                          style={{ width: `${t.share}%` }}
                        />
                      </div>
                      <span className={`w-14 shrink-0 text-right tabular-nums ${isTop ? 'font-semibold text-sky-700' : 'text-slate-500'}`}>
                        {t.share.toFixed(1)}%
                      </span>
                    </div>
                  )
                })
              )}
              {topShare > 0 && result.terms.length > 1 && (
                <p className="pt-1 text-xs text-sky-700">
                  가장 큰 기여: <span className="font-mono font-semibold">{result.terms[0].name}</span> — 이 측정을 더
                  정밀하게 하면 불확도가 가장 많이 줄어요.
                </p>
              )}
              <p className="pt-1 text-xs text-slate-400">
                사용한 값:{' '}
                {result.terms.map((t, i) => (
                  <span key={t.name}>
                    {i > 0 && ' · '}
                    <span className="font-mono">{t.name} = {t.inputText}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      )}

      {result.ok && result.explain && (
        <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer select-none">계산 과정 보기 — 편미분식과 불확도 총괄표</summary>
          <ExplainTable name={block.name} explain={result.explain} resultText={result.text} />
        </details>
      )}

      {result.ok && result.expanded && (
        <p className="text-xs text-slate-400">
          계산 블록 이름은 그 식으로 펼쳐서 한 번에 계산해요 (같은 측정값이 여러 번 나와도 불확도가 맞게 전파돼요):{' '}
          <span className="font-mono text-slate-600">{result.expanded}</span>
        </p>
      )}

      {rows.ok && rows.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {w}
        </p>
      ))}
      {rows.ok && rows.notes.map((n) => (
        <p key={n} className="text-xs text-slate-400">
          {n}
        </p>
      ))}
      {rows.ok === false && result.ok && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          행별 값은 계산할 수 없어요 (그래프 축으로 쓸 수 없어요): {rows.message}
        </p>
      )}
      {rows.ok && rows.rows.length >= 2 && (
        <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer select-none">
            행별 값 {rows.rows.length}개 — 그래프 축으로 쓸 수 있어요
          </summary>
          <table className="mt-2 font-mono">
            <tbody>
              {rows.rows.slice(0, MAX_SHOWN_ROWS).map((r, i) => (
                <tr key={i}>
                  <td className="pr-3 text-slate-400">{i + 1}</td>
                  <td>{r.u > 0 ? formatResult(r.value, r.u).text : formatNumber(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.rows.length > MAX_SHOWN_ROWS && <p className="mt-1 text-slate-400">… 나머지 {rows.rows.length - MAX_SHOWN_ROWS}개</p>}
          <p className="mt-2 text-slate-400">불확도는 각 측정 블록의 B형 불확도를 식에 따라 전파한 값이에요.</p>
        </details>
      )}
    </div>
  )
}
