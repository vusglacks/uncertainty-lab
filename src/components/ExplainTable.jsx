import { formatNumber } from '../lib/stats'

// "계산 과정 보기": 편미분식과 불확도 총괄표를 보여준다.
//   u_c(f) = √( Σ (∂f/∂xᵢ · u(xᵢ))² )   — 변수들이 서로 독립이라고 가정
// 자료는 lib/calc.js 의 evaluateCalc 가 만든 explain 을 그대로 받는다.
export default function ExplainTable({ name, explain, resultText }) {
  const { formulaText, rows, sumSquares, angleNotes } = explain
  const ucValue = Math.sqrt(sumSquares)
  const f = name || 'f'

  return (
    <div className="space-y-3 pt-2">
      <p>
        <span className="text-slate-400">식</span> <span className="font-mono text-slate-800">{f} = {formulaText}</span>
      </p>
      <p className="text-slate-400">
        u_c({f}) = √( Σ (∂{f}/∂xᵢ · u(xᵢ))² ) — 변수들이 서로 독립이라고 보고 합쳐요.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-1 pr-3 font-medium">변수 x</th>
              <th className="py-1 pr-3 font-medium">값</th>
              <th className="py-1 pr-3 font-medium">u(x)</th>
              <th className="py-1 pr-3 font-medium">∂{f}/∂x 식</th>
              <th className="py-1 pr-3 font-medium">∂{f}/∂x 값</th>
              <th className="py-1 pr-3 font-medium">항 ∂{f}/∂x · u</th>
              <th className="py-1 font-medium">기여율</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-slate-100 align-top">
                <td className="py-1 pr-3">{r.name}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{formatNumber(r.x)}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{formatNumber(r.u)}</td>
                <td className="py-1 pr-3">{r.partialText ?? '(식이 너무 길어 생략)'}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{formatNumber(r.partial)}</td>
                <td className="py-1 pr-3 whitespace-nowrap">{formatNumber(r.term)}</td>
                <td className="py-1 whitespace-nowrap">{r.share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-slate-800">
        u_c² = Σ 항² = {rows.map((r) => `(${formatNumber(r.term)})²`).join(' + ')} = {formatNumber(sumSquares)}
        <br />u_c = √(u_c²) = {formatNumber(ucValue)}
      </p>
      {resultText && (
        <p className="font-semibold text-slate-900">
          결과 {f} = {resultText} <span className="font-normal text-slate-400">(유효숫자 규칙으로 맞춘 값)</span>
        </p>
      )}

      {angleNotes.map((n) => (
        <p key={n} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          {n}
        </p>
      ))}
    </div>
  )
}
