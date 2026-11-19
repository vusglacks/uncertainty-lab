// ============================================================
//  손계산 결과와 프로그램 결과 비교 (화면 코드와 분리한 순수 함수)
//
//  학생이 보고서를 쓰기 전에 "내가 손으로 구한 값이 맞나?" 확인하는 용도다.
//  손으로 구한 값은 반올림이 섞여 있으므로 "글자가 똑같은가"가 아니라
//  "화면에 보이는 유효숫자 자리에서 같은가"로 비교한다.
//
//  규칙
//    값    : 손으로 구한 값을 화면에 표시된 자리(소수 몇 째 자리)까지 반올림해서 표시값과 같으면 일치
//    불확도: 손으로 구한 불확도를 같은 자리까지 올림 또는 반올림해서 표시값과 같으면 일치
//            (불확도는 올림이 관례라서 둘 다 인정한다)
//    불확도가 0이면 표시 자리가 따로 없으므로 유효숫자 4자리로 비교한다
//    일치하지 않으면 차이(%)를 알려준다. 차이가 작으면 "중간 계산에서 반올림했을 수 있다"고 덧붙인다
// ============================================================
import { formatResult } from './engine.js'

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

// 손으로 쓴 글자를 값과 불확도로 읽는다.
//   "9.81"            -> { value: 9.81, uncertainty: null }
//   "9.81 ± 0.02"     -> { value: 9.81, uncertainty: 0.02 }   (± 대신 +- 또는 +/- 도 된다)
// 반환: { empty:true } | { ok:false, message } | { ok:true, value, uncertainty }
export function parseHand(text) {
  const t = String(text ?? '').trim().replace(/−/g, '-')
  if (t === '') return { empty: true }
  const parts = t.split(/\s*(?:±|\+\/-|\+-)\s*/)
  if (parts.length > 2) return { ok: false, message: '± 는 한 번만 쓸 수 있어요 (예: 9.81 ± 0.02)' }
  const [v, u] = parts
  if (!NUMBER_RE.test(v)) return { ok: false, message: '값을 숫자로 읽을 수 없어요 (예: 9.81 또는 9.81 ± 0.02)' }
  if (u === undefined) return { ok: true, value: Number(v), uncertainty: null }
  if (!NUMBER_RE.test(u) || Number(u) < 0) return { ok: false, message: '± 뒤의 불확도는 0 이상의 숫자여야 해요' }
  return { ok: true, value: Number(v), uncertainty: Number(u) }
}

// 상대 차이(%) = |손 - 프로그램| / |프로그램| × 100. 프로그램 값이 0이면 정할 수 없다(null).
function percent(hand, ref) {
  return ref === 0 ? null : (Math.abs(hand - ref) / Math.abs(ref)) * 100
}

// 손계산과 프로그램 결과를 비교한다.
//   value, uncertainty: 프로그램이 계산한 값과 합성불확도 (evaluateCalc 의 결과)
//   handText          : 학생이 입력한 글자
// 반환
//   입력이 비었으면      { empty: true }
//   읽을 수 없으면       { ok:false, message }
//   성공하면 { ok:true, valueCheck, uncertaintyCheck, allMatch, shownText }
//     valueCheck / uncertaintyCheck: { hand, shown(표시된 값 글자), match, pct(차이 %), hint }
//     uncertaintyCheck 는 손으로 불확도를 안 썼으면 null
export function compareHand(value, uncertainty, handText) {
  const hand = parseHand(handText)
  if (hand.empty) return { empty: true }
  if (!hand.ok) return hand

  const f = formatResult(value, uncertainty)
  const hasU = uncertainty > 0 && isFinite(uncertainty)

  // 값
  let shownValue, valueMatch
  if (hasU) {
    shownValue = f.value
    const step = 10 ** -f.decimals
    valueMatch = Math.abs(Math.round(hand.value / step) * step - Number(f.value)) < step * 1e-6
  } else {
    shownValue = String(Number(value.toPrecision(4)))
    valueMatch = Number(hand.value.toPrecision(4)) === Number(shownValue)
  }
  const valuePct = percent(hand.value, value)
  const valueCheck = { hand: hand.value, shown: shownValue, match: valueMatch, pct: valuePct, hint: valueMatch ? '' : hintFor(valuePct) }

  // 불확도 (손으로 쓴 경우만)
  let uncertaintyCheck = null
  if (hand.uncertainty !== null) {
    let shownU, uMatch
    if (hasU) {
      shownU = f.uncertainty
      const step = 10 ** -f.decimals
      const shown = Number(f.uncertainty)
      const byCeil = Math.ceil(hand.uncertainty / step - 1e-9) * step
      const byRound = Math.round(hand.uncertainty / step) * step
      uMatch = Math.abs(byCeil - shown) < step * 1e-6 || Math.abs(byRound - shown) < step * 1e-6
    } else {
      shownU = '0'
      uMatch = hand.uncertainty === 0
    }
    const uPct = percent(hand.uncertainty, uncertainty)
    uncertaintyCheck = { hand: hand.uncertainty, shown: shownU, match: uMatch, pct: uPct, hint: uMatch ? '' : hintFor(uPct) }
  }

  return {
    ok: true,
    valueCheck,
    uncertaintyCheck,
    allMatch: valueMatch && (uncertaintyCheck ? uncertaintyCheck.match : true),
    shownText: f.text,
  }
}

// 일치하지 않을 때 덧붙이는 안내. 차이가 작으면 반올림 때문일 수 있다고 알려준다.
function hintFor(pct) {
  if (pct === null) return ''
  if (pct < 1) return '차이가 작아요. 중간 계산에서 반올림했을 수 있어요'
  if (pct < 10) return '식이나 값을 다시 확인해 보세요'
  return '많이 달라요. 식(예: 제곱, 단위 환산)이나 입력값을 확인해 보세요'
}
