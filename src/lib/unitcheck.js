// ============================================================
//  계산 블록의 단위 검사와 결과 단위 구하기 (화면 코드와 분리한 순수 함수)
//
//  "차원 분석"이라는 방법을 쓴다. 식 트리를 아래에서 위로 올라가며 각 노드의 단위를 구한다.
//    곱셈  : 단위를 곱한다           m · s^-1 -> m/s
//    나눗셈: 단위를 나눈다
//    거듭제곱: 지수를 곱한다 (지수는 숫자여야 한다)   m^2
//    덧셈·뺄셈: 두 쪽의 차원이 같아야 한다 (m + s 는 물리적으로 틀렸다) -> 경고
//    sin, exp, ln … : 안에 들어가는 값은 단위가 없어야 한다 (sin(m) 은 틀렸다) -> 경고
//  경고만 하고 계산은 막지 않는다. cm 와 m 를 섞어도 자동으로 환산하지 않고 "단위 기호가 달라요" 라고만 알려준다.
//
//  expand.js 가 펼친 식(측정 블록 변수만 남은 식)을 쓰므로, 계산 블록끼리 이어 쓴 식도 한 번에 검사된다.
// ============================================================
import { parse } from './engine.js'
import { nodeToText } from './symbolic.js'
import { parseUnit, mulQ, divQ, powQ, dimEqual, atomsEqual, isDimless, unitText, namedUnit, DIMLESS } from './units.js'

// 안에 들어가는 값에 단위가 없어야 하는 함수들
const DIMLESS_ARG = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'ln', 'log', 'log2'])

// 숫자만으로 이루어진 식이면 그 값, 아니면 null (지수가 숫자인지 알아낼 때 쓴다)
function constValue(node) {
  switch (node.kind) {
    case 'const': return node.value
    case 'neg': { const v = constValue(node.operand); return v === null ? null : -v }
    case 'binary': {
      const a = constValue(node.left)
      const b = constValue(node.right)
      if (a === null || b === null) return null
      switch (node.op) {
        case '+': return a + b
        case '-': return a - b
        case '*': return a * b
        case '/': return a / b
        case '^': return a ** b
      }
      return null
    }
    default: return null
  }
}

// 식의 단위를 구한다.
//   expr   : 펼친 식 글자 (측정 블록은 __v3 같은 내부 이름)
//   vars   : [{ id, name, block }]  (expand.js 의 결과)
//   angleUnit: 'deg' | 'rad'  (asin/acos/atan 결과의 단위를 정한다)
// 반환 { unit, text, named, warnings, notes }
//   unit : 단위 값 (정할 수 없으면 null),  text : "m/s²" 같은 글자 ('' 이면 단위 없음)
//   named: 결과가 N, J … 로 불리는 차원이면 그 이름
//   warnings: 단위가 안 맞는다는 경고들,  notes: 참고 안내들
export function analyzeUnits(expr, vars, angleUnit = 'deg') {
  const warnings = []
  const notes = []
  const say = (list, msg) => { if (!list.includes(msg)) list.push(msg) }

  // 1) 변수마다 입력한 단위 글자를 해석한다.
  const unitOf = {}
  const nameOf = {}
  const unknown = new Set()
  const emptyNames = []
  let anyUnit = false
  for (const v of vars) {
    nameOf[v.id] = v.name
    const text = String(v.block.unit ?? '').trim()
    const p = parseUnit(text)
    if (!p.ok) {
      return { unit: null, text: '', named: null, warnings: [`'${v.name}' 의 단위 '${text}' 를 읽을 수 없어요 (${p.message}). 단위 검사를 건너뛰었어요`], notes: [] }
    }
    unitOf[v.id] = p.q
    p.unknown.forEach((s) => unknown.add(s))
    if (text === '') emptyNames.push(v.name)
    else anyUnit = true
  }
  if (anyUnit && emptyNames.length) {
    say(notes, `${emptyNames.join(', ')} 의 단위가 비어 있어서 단위 없음(차원 없음)으로 봤어요`)
  }
  if (unknown.size) {
    say(notes, `${[...unknown].map((s) => `'${s}'`).join(', ')} 은(는) 처음 보는 단위라서 새로운 단위로 다뤄요 (다른 단위와 섞이지 않아요)`)
  }
  if (!anyUnit) {
    return { unit: DIMLESS, text: '', named: null, warnings, notes } // 아무 단위도 안 썼으면 검사할 것이 없다
  }

  const show = (node) => nodeToText(node, (n) => nameOf[n] ?? n)
  const label = (q) => (unitText(q) || '단위 없음')

  // 2) 식 트리를 아래에서 위로 올라가며 단위를 구한다. 정할 수 없으면 null (그 위쪽은 검사를 건너뛴다).
  function walk(node) {
    switch (node.kind) {
      case 'const':
        return DIMLESS
      case 'var':
        return unitOf[node.name] ?? DIMLESS
      case 'neg':
        return walk(node.operand)
      case 'binary': {
        const a = walk(node.left)
        const b = walk(node.right)
        if (node.op === '^') {
          const n = constValue(node.right)
          if (b && !isDimless(b)) say(warnings, `지수 '${show(node.right)}' 에 단위(${label(b)})가 있어요. 지수는 단위가 없어야 해요`)
          if (a === null) return null
          if (n !== null) return powQ(a, n)
          if (isDimless(a)) return DIMLESS
          say(warnings, `'${show(node)}' 는 지수가 변수라서 결과 단위를 정할 수 없어요`)
          return null
        }
        if (a === null || b === null) return null
        if (node.op === '*') return mulQ(a, b)
        if (node.op === '/') return divQ(a, b)
        // + - : 차원이 같아야 한다
        if (!dimEqual(a, b)) {
          say(warnings, `'${show(node)}' 에서 단위가 맞지 않아요: ${label(a)} 와(과) ${label(b)} 는 ${node.op === '+' ? '더할' : '뺄'} 수 없어요`)
          return null
        }
        if (!isDimless(a) && !atomsEqual(a, b)) {
          say(warnings, `'${show(node)}' 에서 단위 기호가 달라요: ${label(a)} 와(과) ${label(b)}. 자동으로 환산하지 않으니 같은 단위로 맞춰서 입력하세요`)
        }
        return a
      }
      case 'call': {
        const a = walk(node.arg)
        if (a === null) return null
        if (DIMLESS_ARG.has(node.name) && !isDimless(a)) {
          say(warnings, `${node.name}( ) 안의 '${show(node.arg)}' 에 단위(${label(a)})가 있어요. 이 함수는 단위가 없는 값(각도, 비율)에만 쓸 수 있어요`)
        }
        switch (node.name) {
          case 'asin': case 'acos': case 'atan':
            return parseUnit(angleUnit === 'deg' ? '°' : 'rad').q // 역삼각함수의 결과는 각도
          case 'sqrt': return powQ(a, 0.5)
          case 'cbrt': return powQ(a, 1 / 3)
          case 'abs': return a
          default: return DIMLESS // sin cos tan sinh cosh tanh exp ln log log2
        }
      }
      default:
        return null
    }
  }

  const unit = walk(parse(expr))
  return {
    unit,
    text: unit ? unitText(unit) : '',
    named: unit ? namedUnit(unit) : null,
    warnings,
    notes,
  }
}
