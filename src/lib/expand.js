// ============================================================
//  계산 블록 이름을 "그 블록의 식"으로 펼치기 (화면 코드와 분리한 순수 함수)
//
//  왜 펼치나: 다른 계산 블록의 결과(예: T2 = T^2)를 식에서 쓸 때, 결과 값과 불확도만 받아서
//  "독립인 변수"로 취급하면 틀린 불확도가 나온다. 예) B = T2 / T 에서 T2 와 T 는 같은 T 에서
//  나왔으니 독립이 아니다. 그래서 T2 를 (T^2) 로 펼쳐서 B = (T^2) / T 를 한 번에 미분하면,
//  자동 미분이 T 가 두 번 나오는 것까지 알아서 처리해 준다.
//
//  engine.js 는 건드리지 않는다. parse() 로 만든 계산 트리(AST)를 걸어 다니며
//  펼친 식을 글자로 다시 만들어 engine.js 의 propagate() 에 넘긴다.
// ============================================================
import { parse } from './engine.js'

class CompileError extends Error {}

// 위쪽 블록들 중 이름이 같은 것을 가장 가까운(아래쪽) 것부터 찾는다. 없으면 -1.
function findIndex(blocksAbove, name) {
  for (let i = blocksAbove.length - 1; i >= 0; i--) {
    if (blocksAbove[i].name === name) return i
  }
  return -1
}

const KIND_LABEL = { graph: '그래프 블록' }

// 숫자 상수를 글자로. pi, e 는 이름 그대로 적는다 (parse 가 다시 상수로 읽는다).
function constText(v) {
  if (v === Math.PI) return 'pi'
  if (v === Math.E) return 'e'
  return String(v)
}

// 계산 트리 한 노드를 글자로 바꾼다. 곱셈·나눗셈·거듭제곱 순서가 헷갈리지 않도록
// 이항 연산과 음수는 항상 괄호로 감싼다.
//   const  -> 숫자 그대로
//   var    -> 측정 블록이면 내부 이름(__v + 위치), 계산 블록이면 (그 블록의 식을 펼친 것)
//   neg / binary / call -> 괄호를 두르고 안쪽을 재귀로
// vars: 지금까지 만난 측정 블록들 (내부 이름 -> { id, name, block })
// usedCalcs: 펼친 계산 블록 이름들
function emit(node, blocksAbove, vars, usedCalcs) {
  switch (node.kind) {
    case 'const':
      return constText(node.value)

    case 'var': {
      const index = findIndex(blocksAbove, node.name)
      if (index < 0) throw new CompileError(`'${node.name}' 이름의 블록이 위쪽에 없어요`)
      const b = blocksAbove[index]

      if (b.type === 'measure') {
        // 내부 이름은 블록 위치로 만든다. 같은 이름의 측정 블록이 여러 개여도 서로 구별되고,
        // 같은 블록을 여러 경로로 쓰면 하나의 변수로 합쳐진다(= 상관관계가 맞게 계산된다).
        const id = `__v${index}`
        vars.set(id, { id, name: b.name, block: b })
        return id
      }

      if (b.type === 'calc') {
        if (!b.formula || !b.formula.trim()) {
          throw new CompileError(`'${node.name}' 계산 블록에 수식이 없어요`)
        }
        let sub
        try {
          sub = parse(b.formula)
        } catch (e) {
          throw new CompileError(`'${node.name}' 계산 블록의 수식을 계산할 수 없어요: ${e.message}`)
        }
        usedCalcs.add(node.name)
        try {
          // 그 계산 블록의 식은 "그 블록보다 위쪽"에서 이름을 찾아야 하므로 잘라서 넘긴다.
          // (자르기만 해서 위치 번호는 그대로라서, 위에서 만든 내부 이름이 서로 맞는다)
          // emit 의 결과는 항상 하나의 덩어리(숫자, 이름, 괄호로 싼 식, 함수 호출)라서 괄호를 더 두르지 않는다.
          return emit(sub, blocksAbove.slice(0, index), vars, usedCalcs)
        } catch (e) {
          if (e instanceof CompileError) throw new CompileError(`'${node.name}' 계산 블록: ${e.message}`)
          throw e
        }
      }

      throw new CompileError(`'${node.name}' 은(는) ${KIND_LABEL[b.type] || b.type}이라서 수식에 쓸 수 없어요`)
    }

    case 'neg':
      return `(-${emit(node.operand, blocksAbove, vars, usedCalcs)})`

    case 'binary':
      return `(${emit(node.left, blocksAbove, vars, usedCalcs)} ${node.op} ${emit(node.right, blocksAbove, vars, usedCalcs)})`

    case 'call':
      return `${node.name}(${emit(node.arg, blocksAbove, vars, usedCalcs)})`

    default:
      throw new CompileError('알 수 없는 수식 요소예요')
  }
}

// 수식 하나를 "측정 블록 변수만 남도록" 펼친다.
//   formula    : 수식 문자열
//   blocksAbove: 이 수식이 있는 블록보다 위쪽 블록들 (위→아래 순서 그대로)
// 반환
//   실패: { ok: false, message }
//   성공: { ok: true, expr, vars, text, usedCalcs }
//     expr      : engine.js 에 넘길 펼친 식 (측정 블록은 __v3 같은 내부 이름)
//     vars      : [{ id, name, block }]  펼친 식에 남은 측정 블록들
//     text      : 사람이 읽는 펼친 식 (내부 이름 대신 블록 이름)
//     usedCalcs : 펼친 계산 블록 이름 목록 (비어 있으면 펼칠 것이 없었다는 뜻)
export function compileFormula(formula, blocksAbove) {
  let ast
  try {
    ast = parse(formula)
  } catch (e) {
    return { ok: false, message: e.message }
  }
  const vars = new Map()
  const usedCalcs = new Set()
  let expr
  try {
    expr = emit(ast, blocksAbove, vars, usedCalcs)
  } catch (e) {
    if (e instanceof CompileError) return { ok: false, message: e.message }
    throw e
  }
  const text = expr.replace(/__v(\d+)/g, (id) => vars.get(id)?.name ?? id)
  return { ok: true, expr, vars: [...vars.values()], text, usedCalcs: [...usedCalcs] }
}
