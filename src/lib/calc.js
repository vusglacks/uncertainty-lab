// ============================================================
//  계산 블록 ↔ engine.js 연결부 (화면 코드와 분리)
//  engine.js 는 "이름 -> {value, uncertainty}" 표를 받아 계산하므로,
//  여기서는 수식에 쓰인 이름마다 위쪽 측정 블록을 찾아 그 표를 만들어 넘기고,
//  돌려받은 결과를 화면에 보여주기 좋은 모양으로 정리한다.
//  engine.js 의 계산 코드는 전혀 고치지 않는다.
// ============================================================
import { parse, collectVars, propagate, formatResult } from './engine.js'
import { measureStats } from './stats.js'

function fail(message) {
  return { ok: false, message }
}

// 계산 블록 하나를 계산한다.
//   formula    : 수식 문자열 (예: "4*pi^2*L / T^2")
//   blocksAbove: 이 계산 블록보다 위에 있는 블록들 (위→아래 순서 그대로)
//   angleUnit  : 'deg' | 'rad'  (삼각함수 입력의 각도 단위)
//
// 반환
//   수식이 비어 있으면  { empty: true }
//   계산에 실패하면     { ok: false, message }
//   성공하면            { ok: true, value, uncertainty, text, terms }
//     text  : 유효숫자를 맞춘 "값 ± 불확도"
//     terms : 변수별 { name, share(%), inputText } — 오차 기여도가 큰 순서
export function evaluateCalc(formula, blocksAbove, angleUnit) {
  if (!formula || !formula.trim()) return { empty: true }

  // 1) 수식에 쓰인 변수 이름을 모은다. 문법이 틀렸으면 engine.js 가 던진 메시지를 그대로 보여준다.
  let vars
  try {
    vars = collectVars(parse(formula))
  } catch (e) {
    return fail(e.message)
  }

  // 2) 변수마다 위쪽 측정 블록을 찾아 평균(값)과 합성표준불확도(불확도)를 넣는다.
  const inputs = {}
  const inputTexts = {}
  for (const name of vars) {
    // 같은 이름이 여럿이면 가장 가까운(바로 위쪽) 블록을 쓴다.
    const block = [...blocksAbove].reverse().find((b) => b.name === name)
    if (!block) return fail(`'${name}' 이름의 블록이 위쪽에 없어요`)
    if (block.type !== 'measure') {
      return fail(`'${name}' 은(는) 계산 블록이에요. 수식에는 측정 블록의 이름만 쓸 수 있어요`)
    }

    const s = measureStats(block)
    if (s.mean === null) return fail(`'${name}' 측정 블록에 측정값이 없어요`)
    if (s.typeBError) return fail(`'${name}' 측정 블록의 ${s.typeBError}`)
    if (s.uC === null) {
      return fail(`'${name}' 의 불확도를 계산할 수 없어요 (측정값 2개 이상, 또는 B형 불확도가 필요해요)`)
    }

    inputs[name] = { value: s.mean, uncertainty: s.uC }
    inputTexts[name] = formatResult(s.mean, s.uC).text
  }

  // 3) engine.js 로 값과 불확도를 계산한다. (자동 미분 -> 오차 전파)
  //    도(°) 단위일 때 삼각함수 안의 변수만 라디안으로 바꾸는 것도 engine.js 가 처리한다.
  let r
  try {
    r = propagate(formula, inputs, { degrees: angleUnit === 'deg' })
  } catch (e) {
    return fail(e.message)
  }
  if (!isFinite(r.value) || !isFinite(r.uncertainty)) {
    return fail('결과가 숫자가 아니에요. 수식과 입력값(예: 0으로 나누기, 범위 밖 값)을 확인하세요')
  }

  return {
    ok: true,
    value: r.value,
    uncertainty: r.uncertainty,
    text: formatResult(r.value, r.uncertainty).text, // 유효숫자 처리
    // 오차 기여도(%) = (∂f/∂xi · u(xi))² / u_c² × 100  — engine.js 가 이미 share 로 계산해 둠
    terms: r.terms.map((t) => ({ name: t.name, share: t.share, inputText: inputTexts[t.name] })),
  }
}
