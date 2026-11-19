// ============================================================
//  기호 미분: 식을 "편미분식 글자"로 돌려준다 (계산 과정 보기용)
//
//  engine.js 의 자동 미분은 숫자(편미분 값)만 돌려주고 식은 만들지 않는다.
//  그래서 여기서는 engine.js 의 parse() 가 만든 계산 트리(AST)를 읽어서
//    1) 미분 규칙(곱·몫·거듭제곱·연쇄법칙)으로 미분한 트리를 만들고
//    2) 곱·몫·거듭제곱을 "계수 × 변수들의 거듭제곱" 꼴로 정리해서
//    3) 읽기 좋은 글자로 바꾼다.
//  engine.js 는 전혀 고치지 않는다. (자동 미분 값과 일치하는지는 테스트로 확인한다)
//
//  AST 노드 모양 (engine.js 와 같다)
//    { kind: 'const', value }  { kind: 'var', name }  { kind: 'neg', operand }
//    { kind: 'binary', op: '+'|'-'|'*'|'/'|'^', left, right }  { kind: 'call', name, arg }
// ============================================================
import { parse } from './engine.js'

// ---------- 노드 만들기 ----------
const num = (value) => ({ kind: 'const', value })
const bin = (op, left, right) => ({ kind: 'binary', op, left, right })
const neg = (operand) => ({ kind: 'neg', operand })
const call = (name, arg) => ({ kind: 'call', name, arg })

const isNamedConst = (n) => n.kind === 'const' && (n.value === Math.PI || n.value === Math.E)
const isPlainNum = (n) => n.kind === 'const' && !isNamedConst(n)

// ---------- 글자로 바꾸기 ----------
// 연산 우선순위: + - (1) < * / (2) < 음수 (3) < ^ (4) < 함수·값 (5)
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 }

function fmtNumber(v) {
  if (Number.isInteger(v)) return String(v)
  return String(Number(v.toPrecision(8)))
}

// 노드 -> 글자. nameOf(변수 이름) 으로 화면에 보일 이름을 바꿀 수 있다.
//   parentPrec: 바깥 연산의 우선순위, side: 'left' | 'right' (필요한 괄호만 붙이려고)
export function nodeToText(node, nameOf = (n) => n, parentPrec = 0, side = 'left') {
  switch (node.kind) {
    case 'const':
      if (node.value === Math.PI) return 'pi'
      if (node.value === Math.E) return 'e'
      return fmtNumber(node.value)
    case 'var':
      return nameOf(node.name)
    case 'neg': {
      // -a*b/c 는 (-a)*b/c 와 같은 값이라 곱·몫 앞의 마이너스는 괄호 없이 쓴다. 합은 -(a + b) 처럼 괄호.
      const inner = `-${nodeToText(node.operand, nameOf, 2, 'left')}`
      // 음수가 오른쪽 피연산자이거나 거듭제곱의 밑일 때는 괄호로 묶는다: a*(-b), (-a)^2
      return side === 'right' || parentPrec >= 4 ? `(${inner})` : inner
    }
    case 'call':
      return `${node.name}(${nodeToText(node.arg, nameOf, 0, 'left')})`
    case 'binary': {
      const p = PREC[node.op]
      const l = nodeToText(node.left, nameOf, p, 'left')
      const r = nodeToText(node.right, nameOf, p, 'right')
      const sp = node.op === '+' || node.op === '-' ? ` ${node.op} ` : node.op
      let s = `${l}${sp}${r}`
      // 우선순위가 낮으면 괄호. 같은 우선순위인 오른쪽 피연산자도(a-(b-c)) 괄호, 단 ^ 는 오른쪽 결합이라 왼쪽이 괄호
      const needParen =
        p < parentPrec ||
        (p === parentPrec && node.op !== '^' && side === 'right') ||
        (p === parentPrec && node.op === '^' && side === 'left')
      if (needParen) s = `(${s})`
      return s
    }
    default:
      return '?'
  }
}

// ---------- 정리(간단히 하기) ----------
// 식을 "항들의 합"으로, 각 항을 "계수 × 원자들의 거듭제곱"으로 바꿔서 같은 것끼리 묶는다.
//   원자(atom): 변수, pi·e, 함수 호출, 거듭제곱 지수가 변수인 식, 괄호로 묶인 합 등
//   예) (4*pi^2*L * (2*T)) / (T^2)^2  ->  계수 8, 원자 pi^2, L^1, T^-3  ->  8*pi^2*L/T^3

const EPS = 1e-12

// 원자의 정체를 구별하는 글자 (같은 글자면 같은 원자)
const keyOf = (node) => nodeToText(node)

// 계수 c 를 분수 n/d 로 (분모 1000 이하). 안 되면 d = 1, n = c
function asFraction(c) {
  for (let d = 1; d <= 1000; d++) {
    const n = c * d
    if (Math.abs(n - Math.round(n)) < 1e-9 * Math.max(1, Math.abs(n))) return { n: Math.round(n), d }
  }
  return { n: c, d: 1 }
}

// 곱 하나: { coef, atoms: [{ key, node, exp }] }
const one = () => ({ coef: 1, atoms: [] })

function mulProducts(a, b) {
  const atoms = a.atoms.map((x) => ({ ...x }))
  for (const y of b.atoms) {
    const hit = atoms.find((x) => x.key === y.key)
    if (hit) hit.exp += y.exp
    else atoms.push({ ...y })
  }
  return { coef: a.coef * b.coef, atoms: atoms.filter((x) => Math.abs(x.exp) > EPS) }
}

function invertProduct(p) {
  return { coef: 1 / p.coef, atoms: p.atoms.map((x) => ({ ...x, exp: -x.exp })) }
}

// 곱 p 를 k 제곱. 계수가 음수이면서 k 가 정수가 아니면 계산할 수 없으므로 null
function powProduct(p, k) {
  if (p.coef < 0 && !Number.isInteger(k)) return null
  return { coef: p.coef ** k, atoms: p.atoms.map((x) => ({ ...x, exp: x.exp * k })) }
}

const atomOf = (node) => ({ coef: 1, atoms: [{ key: keyOf(node), node, exp: 1 }] })

// 노드 -> 항(곱)들의 목록
function toTerms(node) {
  if (node.kind === 'binary' && node.op === '+') return [...toTerms(node.left), ...toTerms(node.right)]
  if (node.kind === 'binary' && node.op === '-') {
    return [...toTerms(node.left), ...toTerms(node.right).map((t) => ({ ...t, coef: -t.coef }))]
  }
  if (node.kind === 'neg') return toTerms(node.operand).map((t) => ({ ...t, coef: -t.coef }))
  return [toProduct(node)]
}

// 노드 -> 곱 하나
function toProduct(node) {
  switch (node.kind) {
    case 'const':
      return isNamedConst(node) ? atomOf(node) : { coef: node.value, atoms: [] }
    case 'var':
      return atomOf(node)
    case 'neg':
      return { ...toProduct(node.operand), coef: -toProduct(node.operand).coef }
    case 'call':
      return atomOf(call(node.name, simplify(node.arg)))
    case 'binary': {
      if (node.op === '*') return mulProducts(toProduct(node.left), toProduct(node.right))
      if (node.op === '/') return mulProducts(toProduct(node.left), invertProduct(toProduct(node.right)))
      if (node.op === '^') {
        const e = simplify(node.right)
        if (isPlainNum(e)) {
          const p = powProduct(toProduct(node.left), e.value)
          if (p) return p
        }
        return atomOf(bin('^', simplify(node.left), e)) // 지수가 변수인 식 등은 통째로 하나의 원자
      }
      // + 또는 -: 합이 한 항이면 그 항, 아니면 괄호로 묶인 합 하나를 원자로
      const terms = combineTerms(toTerms(node))
      if (terms.length === 0) return { coef: 0, atoms: [] }
      if (terms.length === 1) return terms[0]
      return atomOf(termsToNode(terms))
    }
    default:
      return one()
  }
}

// 같은 원자 구성을 가진 항끼리 계수를 더한다. 계수가 0이면 버린다.
function combineTerms(terms) {
  const merged = []
  for (const t of terms) {
    const sig = t.atoms
      .map((x) => `${x.key}^${Number(x.exp.toPrecision(10))}`)
      .sort()
      .join('*')
    const hit = merged.find((m) => m.sig === sig)
    if (hit) hit.term.coef += t.coef
    else merged.push({ sig, term: { coef: t.coef, atoms: t.atoms.map((x) => ({ ...x })) } })
  }
  return merged.map((m) => m.term).filter((t) => Math.abs(t.coef) > EPS)
}

const powNode = (atom, e) => (Math.abs(e - 1) < EPS ? atom.node : bin('^', atom.node, num(e)))
const chain = (op, parts) => parts.reduce((acc, p) => (acc ? bin(op, acc, p) : p), null)

// 곱 하나 -> 노드 (부호는 바깥에서 처리)
function productToNode(p, absolute) {
  const c = absolute ? Math.abs(p.coef) : p.coef
  const { n, d } = asFraction(Math.abs(c))
  const top = []
  const bottom = []
  if (n !== 1 || p.atoms.length === 0) top.push(num(n))
  if (d !== 1) bottom.push(num(d))
  // 읽기 좋은 순서: 변수·pi·e 를 앞에, 함수·괄호 식을 뒤에 (같은 종류끼리는 나온 순서 그대로)
  const rank = (a) => (a.node.kind === 'var' || isNamedConst(a.node) ? 0 : 1)
  for (const a of [...p.atoms].sort((x, y) => rank(x) - rank(y))) {
    if (a.exp > 0) top.push(powNode(a, a.exp))
    else bottom.push(powNode(a, -a.exp))
  }
  let node = chain('*', top) || num(1)
  if (bottom.length) node = bin('/', node, chain('*', bottom))
  return !absolute && c < 0 ? neg(node) : node
}

// 항들 -> 합의 노드. 계수가 음수인 항은 뺄셈으로
function termsToNode(terms) {
  let acc = null
  for (const t of terms) {
    if (acc === null) {
      acc = productToNode(t, false)
    } else if (t.coef < 0) {
      acc = bin('-', acc, productToNode(t, true))
    } else {
      acc = bin('+', acc, productToNode(t, true))
    }
  }
  return acc ?? num(0)
}

// 식을 정리한다.
export function simplify(node) {
  const terms = combineTerms(toTerms(node))
  return termsToNode(terms)
}

// ---------- 미분 ----------
// node 를 변수 id 로 미분한 (정리된) 식.
//   opts.degrees: 도 단위일 때 asin/acos/atan 의 결과가 도(°)라서 미분에 180/π 가 곱해진다
export function differentiate(node, id, opts = {}) {
  return simplify(rawDiff(node, id, opts))
}

const D = (u) => num(u) // 상수 단축

function rawDiff(node, id, opts) {
  const d = (n) => rawDiff(n, id, opts)
  switch (node.kind) {
    case 'const':
      return D(0)
    case 'var':
      return D(node.name === id ? 1 : 0)
    case 'neg':
      return neg(d(node.operand))

    case 'binary': {
      const { op, left: a, right: b } = node
      const da = d(a)
      const db = d(b)
      if (op === '+') return bin('+', da, db)
      if (op === '-') return bin('-', da, db)
      if (op === '*') return bin('+', bin('*', da, b), bin('*', a, db))
      if (op === '/') {
        // (a/b)' = (a'b - ab') / b²
        return bin('/', bin('-', bin('*', da, b), bin('*', a, db)), bin('^', b, D(2)))
      }
      if (op === '^') {
        // 지수가 상수:  (a^n)' = n·a^(n-1)·a'      밑이 상수: (c^b)' = c^b·ln(c)·b'
        // 둘 다 변수:   (a^b)' = a^b·( b'·ln(a) + b·a'/a )
        const hasVar = (n) => isDependent(n, id)
        if (!hasVar(b)) return bin('*', bin('*', b, bin('^', a, bin('-', b, D(1)))), da)
        if (!hasVar(a)) return bin('*', bin('*', node, call('ln', a)), db)
        return bin('*', node, bin('+', bin('*', db, call('ln', a)), bin('/', bin('*', b, da), a)))
      }
      throw new Error(`모르는 연산자: ${op}`)
    }

    case 'call': {
      const u = node.arg
      const du = d(u)
      const deg = opts.degrees ? bin('/', D(180), D(Math.PI)) : D(1) // 역삼각함수 결과를 도로 바꾸는 계수
      const sq = (x) => bin('^', x, D(2))
      let fp // 바깥 함수의 도함수 f'(u)
      switch (node.name) {
        case 'sin': fp = call('cos', u); break
        case 'cos': fp = neg(call('sin', u)); break
        case 'tan': fp = bin('/', D(1), sq(call('cos', u))); break
        case 'asin': fp = bin('*', deg, bin('/', D(1), call('sqrt', bin('-', D(1), sq(u))))); break
        case 'acos': fp = neg(bin('*', deg, bin('/', D(1), call('sqrt', bin('-', D(1), sq(u)))))); break
        case 'atan': fp = bin('*', deg, bin('/', D(1), bin('+', D(1), sq(u)))); break
        case 'sinh': fp = call('cosh', u); break
        case 'cosh': fp = call('sinh', u); break
        case 'tanh': fp = bin('-', D(1), sq(call('tanh', u))); break
        case 'exp': fp = node; break
        case 'ln': fp = bin('/', D(1), u); break
        case 'log': fp = bin('/', D(1), bin('*', u, call('ln', D(10)))); break
        case 'log2': fp = bin('/', D(1), bin('*', u, call('ln', D(2)))); break
        case 'sqrt': fp = bin('/', D(1), bin('*', D(2), node)); break
        case 'cbrt': fp = bin('/', D(1), bin('*', D(3), sq(node))); break
        case 'abs': fp = bin('/', node, u); break // |u|' = |u|/u  (u = 0 에서는 정의되지 않음)
        default: throw new Error(`모르는 함수: ${node.name}`)
      }
      return bin('*', fp, du)
    }
    default:
      throw new Error('알 수 없는 노드')
  }
}

// node 안에 변수 id 가 들어 있는가
function isDependent(node, id) {
  if (node.kind === 'var') return node.name === id
  if (node.kind === 'neg') return isDependent(node.operand, id)
  if (node.kind === 'call') return isDependent(node.arg, id)
  if (node.kind === 'binary') return isDependent(node.left, id) || isDependent(node.right, id)
  return false
}

// 식 글자(펼친 식 expr)를 id 로 미분한 편미분식 글자. 너무 길면 null.
//   expr  : engine.js 가 읽을 수 있는 식 글자 (변수 이름은 id 그대로)
//   nameOf: id -> 화면에 보일 이름
export function partialText(expr, id, nameOf = (n) => n, opts = {}) {
  const text = nodeToText(differentiate(parse(expr), id, opts), nameOf)
  return text.length > 300 ? null : text
}

// 식 글자를 정리해서 글자로 (펼친 식을 보기 좋게)
export function simplifiedText(expr, nameOf = (n) => n) {
  return nodeToText(simplify(parse(expr)), nameOf)
}

// 삼각함수(sin, cos, tan) 안에 들어 있는 변수들의 id. 도 단위일 때 라디안으로 바뀌는 변수가 이것이다.
// (engine.js 의 isAngleVar 와 같은 규칙)
export function angleVarIds(node, inside = false, out = new Set()) {
  if (node.kind === 'var') {
    if (inside) out.add(node.name)
  } else if (node.kind === 'call') {
    angleVarIds(node.arg, inside || ['sin', 'cos', 'tan'].includes(node.name), out)
  } else if (node.kind === 'binary') {
    angleVarIds(node.left, inside, out)
    angleVarIds(node.right, inside, out)
  } else if (node.kind === 'neg') {
    angleVarIds(node.operand, inside, out)
  }
  return out
}
