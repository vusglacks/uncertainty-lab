import { useId } from 'react'
import { axisDomain } from '../lib/graph'
import { equationText } from '../lib/regression'

// 오차막대 산점도 + 추세선을 SVG로 직접 그린다 (차트 라이브러리 없음).
// PNG 로 저장할 때 SVG 글자를 그대로 이미지로 바꾸므로, 스타일은 CSS 클래스가 아니라
// 모두 속성(fill, stroke …)으로 적는다. (클래스는 저장된 이미지에 따라가지 않는다)
const W = 640
const H = 420
const M = { left: 72, right: 24, top: 24, bottom: 64 } // 그림 둘레 여백 (눈금 글자 자리)
const FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif'

// 계수를 4자리 유효숫자로 (부동소수점 찌꺼기 정리)
const num4 = (v) => String(Number(v.toPrecision(4)))

// 추세선(직선·곡선)을 따라 점을 촘촘히 찍어서 이은 SVG 경로. 계산할 수 없는 곳(로그의 x≤0 등)은 끊는다.
// 화면 밖으로 너무 멀리 나가는 값(지수 곡선의 급증)은 좌표를 제한해서 그림이 깨지지 않게 한다.
function curvePath(fit, X, Y, sx, sy) {
  const STEPS = 160
  let d = ''
  let pen = false
  for (let i = 0; i <= STEPS; i++) {
    const x = X.min + ((X.max - X.min) * i) / STEPS
    const y = fit.predict(x)
    if (!Number.isFinite(y)) {
      pen = false
      continue
    }
    const py = Math.min(Math.max(sy(y), -1000), H + 1000)
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${py.toFixed(1)} `
    pen = true
  }
  return d
}

export default function Chart({ model, svgRef }) {
  const clipId = useId()
  const { points, xLabel, yLabel, xName, yName, fit } = model

  const X = axisDomain(points, 'x', 'ux')
  const Y = axisDomain(points, 'y', 'uy')
  const pw = W - M.left - M.right
  const ph = H - M.top - M.bottom
  // 데이터 값 -> 그림 위의 좌표
  const sx = (v) => M.left + ((v - X.min) / (X.max - X.min)) * pw
  const sy = (v) => M.top + ph - ((v - Y.min) / (Y.max - Y.min)) * ph

  const eq = fit ? equationText(fit, xName, yName) : ''

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`${yLabel} 대 ${xLabel} 그래프`}
      style={{ maxWidth: W, display: 'block' }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={M.left} y={M.top} width={pw} height={ph} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

      {/* 눈금선과 눈금 글자 */}
      {X.ticks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + ph} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={sx(t)} x2={sx(t)} y1={M.top + ph} y2={M.top + ph + 5} stroke="#475569" strokeWidth="1" />
          <text x={sx(t)} y={M.top + ph + 20} textAnchor="middle" fontSize="12" fill="#475569" fontFamily={FONT}>
            {t.toFixed(X.decimals)}
          </text>
        </g>
      ))}
      {Y.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} x2={M.left + pw} y1={sy(t)} y2={sy(t)} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={M.left - 5} x2={M.left} y1={sy(t)} y2={sy(t)} stroke="#475569" strokeWidth="1" />
          <text x={M.left - 9} y={sy(t) + 4} textAnchor="end" fontSize="12" fill="#475569" fontFamily={FONT}>
            {t.toFixed(Y.decimals)}
          </text>
        </g>
      ))}

      {/* 축과 축 이름 */}
      <rect x={M.left} y={M.top} width={pw} height={ph} fill="none" stroke="#475569" strokeWidth="1" />
      <text x={M.left + pw / 2} y={H - 14} textAnchor="middle" fontSize="14" fill="#0f172a" fontFamily={FONT}>
        {xLabel}
      </text>
      <text
        x={18}
        y={M.top + ph / 2}
        textAnchor="middle"
        fontSize="14"
        fill="#0f172a"
        fontFamily={FONT}
        transform={`rotate(-90 18 ${M.top + ph / 2})`}
      >
        {yLabel}
      </text>

      <g clipPath={`url(#${clipId})`}>
        {/* 추세선 */}
        {fit && <path d={curvePath(fit, X, Y, sx, sy)} fill="none" stroke="#ef4444" strokeWidth="2" />}

        {/* 오차막대: 세로(y 불확도), 가로(x 불확도). 양 끝에 짧은 가로선(캡) */}
        {points.map((p, i) => (
          <g key={i} stroke="#334155" strokeWidth="1.5">
            {p.uy > 0 && (
              <>
                <line x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y - p.uy)} y2={sy(p.y + p.uy)} />
                <line x1={sx(p.x) - 4} x2={sx(p.x) + 4} y1={sy(p.y - p.uy)} y2={sy(p.y - p.uy)} />
                <line x1={sx(p.x) - 4} x2={sx(p.x) + 4} y1={sy(p.y + p.uy)} y2={sy(p.y + p.uy)} />
              </>
            )}
            {p.ux > 0 && (
              <>
                <line x1={sx(p.x - p.ux)} x2={sx(p.x + p.ux)} y1={sy(p.y)} y2={sy(p.y)} />
                <line x1={sx(p.x - p.ux)} x2={sx(p.x - p.ux)} y1={sy(p.y) - 4} y2={sy(p.y) + 4} />
                <line x1={sx(p.x + p.ux)} x2={sx(p.x + p.ux)} y1={sy(p.y) - 4} y2={sy(p.y) + 4} />
              </>
            )}
          </g>
        ))}

        {/* 측정점 */}
        {points.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
        ))}
      </g>

      {/* 추세선 식과 결정계수 (그림 안에 넣어서 저장한 이미지에도 보이게) */}
      {fit && (
        <g fontFamily={FONT} fontSize="13" fill="#b91c1c">
          <rect x={M.left + 8} y={M.top + 8} width={Math.max(210, eq.length * 8 + 24)} height={fit.r2 === null ? 28 : 48} fill="#ffffff" fillOpacity="0.85" />
          <text x={M.left + 14} y={M.top + 26}>{eq}</text>
          {fit.r2 !== null && <text x={M.left + 14} y={M.top + 46}>{`R² = ${num4(fit.r2)}`}</text>}
        </g>
      )}
    </svg>
  )
}
