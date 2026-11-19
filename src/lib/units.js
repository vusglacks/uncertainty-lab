// ============================================================
//  단위 해석: "m/s²", "kg·m/s²", "cm", "kPa" 같은 글자를 차원으로 바꾼다 (화면 코드와 분리한 순수 함수)
//
//  단위 하나는 이렇게 표현한다.
//    dim   : 기본 차원별 지수  예) N = kg·m/s² -> { kg: 1, m: 1, s: -2 }
//            (길이 m, 질량 kg, 시간 s, 전류 A, 온도 K, 물질량 mol, 광도 cd)
//    atoms : 사용자가 쓴 단위 기호별 지수 (화면에 보여줄 용도)  예) "cm/s" -> { cm: 1, s: -1 }
//    scale : SI 기본 단위로 바꿀 때의 배율  예) cm -> 0.01
//
//  덧셈은 "dim 이 같을 때만" 의미가 있다 (m + s 는 안 된다).
//  cm 와 m 처럼 dim 은 같고 기호가 다르면 경고만 하고 자동으로 환산하지는 않는다.
//  결과 단위는 곱·나눗셈·거듭제곱에 따라 atoms 의 지수를 더하고 빼서 만든다.
// ============================================================

const EPS = 1e-9

// ---------- 단위 표 ----------
// 접두어: 기호 -> 10 의 거듭제곱 배율
const PREFIXES = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24,
}
const PREFIX_KEYS = Object.keys(PREFIXES).sort((a, b) => b.length - a.length) // 긴 접두어(da)부터 시도

const D = (obj) => obj
// noPrefix: 접두어를 붙일 수 없는 단위 (min, h, °, … 는 "kmin" 같은 말이 없다)
const UNITS = {
  m: { dim: D({ m: 1 }) },
  g: { dim: D({ kg: 1 }), scale: 1e-3 }, // 기본 단위는 kg 이라서 g 는 1e-3 배
  s: { dim: D({ s: 1 }) },
  A: { dim: D({ A: 1 }) },
  K: { dim: D({ K: 1 }) },
  mol: { dim: D({ mol: 1 }) },
  cd: { dim: D({ cd: 1 }) },
  N: { dim: D({ kg: 1, m: 1, s: -2 }) },
  J: { dim: D({ kg: 1, m: 2, s: -2 }) },
  W: { dim: D({ kg: 1, m: 2, s: -3 }) },
  Pa: { dim: D({ kg: 1, m: -1, s: -2 }) },
  Hz: { dim: D({ s: -1 }) },
  C: { dim: D({ A: 1, s: 1 }) },
  V: { dim: D({ kg: 1, m: 2, s: -3, A: -1 }) },
  Ω: { dim: D({ kg: 1, m: 2, s: -3, A: -2 }) },
  ohm: { dim: D({ kg: 1, m: 2, s: -3, A: -2 }) },
  F: { dim: D({ kg: -1, m: -2, s: 4, A: 2 }) },
  T: { dim: D({ kg: 1, s: -2, A: -1 }) },
  H: { dim: D({ kg: 1, m: 2, s: -2, A: -2 }) },
  S: { dim: D({ kg: -1, m: -2, s: 3, A: 2 }) },
  L: { dim: D({ m: 3 }), scale: 1e-3 },
  l: { dim: D({ m: 3 }), scale: 1e-3 },
  bar: { dim: D({ kg: 1, m: -1, s: -2 }), scale: 1e5 },
  eV: { dim: D({ kg: 1, m: 2, s: -2 }), scale: 1.602176634e-19 },
  min: { dim: D({ s: 1 }), scale: 60, noPrefix: true },
  h: { dim: D({ s: 1 }), scale: 3600, noPrefix: true },
  atm: { dim: D({ kg: 1, m: -1, s: -2 }), scale: 101325, noPrefix: true },
  Å: { dim: D({ m: 1 }), scale: 1e-10, noPrefix: true },
  rad: { dim: D({}), noPrefix: true }, //             각도는 차원이 없다 (삼각함수 안에 넣을 수 있다)
  '°': { dim: D({}), scale: Math.PI / 180, noPrefix: true },
  deg: { dim: D({}), scale: Math.PI / 180, noPrefix: true },
  '%': { dim: D({}), scale: 0.01, noPrefix: true },
}

// 곱·몫으로 이름이 붙은 유도 단위. 결과 단위가 이 차원이면 "(= N)" 처럼 알려준다.
const NAMED = [
  ['N', { kg: 1, m: 1, s: -2 }],
  ['J', { kg: 1, m: 2, s: -2 }],
  ['W', { kg: 1, m: 2, s: -3 }],
  ['Pa', { kg: 1, m: -1, s: -2 }],
  ['Hz', { s: -1 }],
  ['C', { A: 1, s: 1 }],
  ['V', { kg: 1, m: 2, s: -3, A: -1 }],
  ['Ω', { kg: 1, m: 2, s: -3, A: -2 }],
  ['F', { kg: -1, m: -2, s: 4, A: 2 }],
  ['T', { kg: 1, s: -2, A: -1 }],
  ['H', { kg: 1, m: 2, s: -2, A: -2 }],
]
const BASE_SYMBOLS = new Set(['kg', 'm', 's', 'A', 'K', 'mol', 'cd'])

// ---------- 단위 값(Q) 다루기 ----------
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => Math.abs(v) > EPS))

export const DIMLESS = Object.freeze({ dim: {}, atoms: {}, scale: 1 })

function addExp(a, b, k = 1) {
  const out = { ...a }
  for (const [key, v] of Object.entries(b)) out[key] = (out[key] ?? 0) + k * v
  return clean(out)
}
export const mulQ = (a, b) => ({ dim: addExp(a.dim, b.dim), atoms: addExp(a.atoms, b.atoms), scale: a.scale * b.scale })
export const divQ = (a, b) => ({ dim: addExp(a.dim, b.dim, -1), atoms: addExp(a.atoms, b.atoms, -1), scale: a.scale / b.scale })
export const powQ = (a, n) => ({
  dim: clean(Object.fromEntries(Object.entries(a.dim).map(([k, v]) => [k, v * n]))),
  atoms: clean(Object.fromEntries(Object.entries(a.atoms).map(([k, v]) => [k, v * n]))),
  scale: a.scale ** n,
})

// 두 차원이 같은가 (m 와 cm 는 같다, m 와 s 는 다르다)
export function dimEqual(a, b) {
  const keys = new Set([...Object.keys(a.dim), ...Object.keys(b.dim)])
  for (const k of keys) if (Math.abs((a.dim[k] ?? 0) - (b.dim[k] ?? 0)) > EPS) return false
  return true
}
// 차원이 없는가 (비율, 각도, 단위 없음)
export const isDimless = (q) => Object.keys(q.dim).length === 0
// 단위 기호까지 똑같은가 (cm 와 m 는 차원은 같지만 기호는 다르다)
export function atomsEqual(a, b) {
  const keys = new Set([...Object.keys(a.atoms), ...Object.keys(b.atoms)])
  for (const k of keys) if (Math.abs((a.atoms[k] ?? 0) - (b.atoms[k] ?? 0)) > EPS) return false
  return true
}

// ---------- 글자로 보여주기 ----------
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }
const num = (n) => String(Number(n.toPrecision(6)))
function powText(sym, exp) {
  const e = Math.round(exp * 1e9) / 1e9 // 1/3 을 세 번 곱한 것 같은 부동소수점 찌꺼기를 지운다
  if (Math.abs(e - 1) < EPS) return sym
  if (Number.isInteger(e) && e >= 2 && e <= 9) return `${sym}${SUP[String(e)]}`
  return `${sym}^${num(e)}`
}

// atoms -> "kg·m/s²" 꼴 글자. 분자가 없으면 "1/s", 단위가 없으면 빈 글자.
export function unitText(q) {
  const entries = Object.entries(q.atoms)
  const top = entries.filter(([, e]) => e > 0).map(([s, e]) => powText(s, e))
  const bottom = entries.filter(([, e]) => e < 0).map(([s, e]) => powText(s, -e))
  if (!top.length && !bottom.length) return ''
  const num = top.length ? top.join('·') : '1'
  if (!bottom.length) return num
  return `${num}/${bottom.length > 1 ? `(${bottom.join('·')})` : bottom[0]}`
}

// 결과 단위가 N, J, W … 로 불리는 차원이면 그 이름 (기호가 모두 SI 기본 단위일 때만)
export function namedUnit(q) {
  if (!Object.keys(q.atoms).every((s) => BASE_SYMBOLS.has(s))) return null
  const hit = NAMED.find(([, dim]) => dimEqual(q, { dim }))
  return hit ? hit[0] : null
}

// ---------- 글자 -> 단위 ----------
function lookup(symbol) {
  const exact = UNITS[symbol]
  if (exact) return { dim: exact.dim, atoms: { [symbol]: 1 }, scale: exact.scale ?? 1, known: true }
  for (const p of PREFIX_KEYS) {
    if (symbol.startsWith(p) && symbol.length > p.length) {
      const rest = UNITS[symbol.slice(p.length)]
      if (rest && !rest.noPrefix) {
        return { dim: rest.dim, atoms: { [symbol]: 1 }, scale: PREFIXES[p] * (rest.scale ?? 1), known: true }
      }
    }
  }
  // 모르는 기호는 그 자체가 새로운 차원인 단위로 본다 (예: "개", "회", "pH"). 서로 다른 모르는 단위는 섞이지 않는다.
  return { dim: { [`?${symbol}`]: 1 }, atoms: { [symbol]: 1 }, scale: 1, known: false }
}

const SUPER_RE = /[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g
const SUPER_MAP = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

function tokenize(text) {
  const t = text.replace(SUPER_RE, (m) => '^' + [...m].map((c) => SUPER_MAP[c]).join(''))
  const out = []
  let i = 0
  while (i < t.length) {
    const c = t[i]
    if (/\s/.test(c)) { i++; continue }
    if ('*·×⋅'.includes(c)) { out.push({ t: '*' }); i++; continue }
    if ('/^()'.includes(c)) { out.push({ t: c }); i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < t.length && /[0-9.]/.test(t[j])) j++
      out.push({ t: 'num', v: Number(t.slice(i, j)) })
      i = j
      continue
    }
    if (c === '-' || c === '+' || c === '−') { out.push({ t: 'sign', v: c === '+' ? 1 : -1 }); i++; continue }
    // 기호: 숫자·연산자·공백이 아닌 글자들 (m, kg, µm, Ω, °, % …)
    let j = i
    while (j < t.length && !/[\s0-9.*·×⋅/^()+\-−]/.test(t[j])) j++
    if (j === i) throw new Error(`읽을 수 없는 글자: '${c}'`)
    out.push({ t: 'sym', v: t.slice(i, j) })
    i = j
  }
  return out
}

// 단위 글자를 해석한다.
//   빈 글자  -> 단위 없음(DIMLESS)
//   반환: { ok:true, q, unknown:[모르는 기호들] } 또는 { ok:false, message }
export function parseUnit(text) {
  const src = String(text ?? '').trim()
  if (src === '') return { ok: true, q: DIMLESS, unknown: [] }
  let toks
  try {
    toks = tokenize(src)
  } catch (e) {
    return { ok: false, message: e.message }
  }
  let pos = 0
  const unknown = []
  const peek = () => toks[pos]
  const fail = (m) => { throw new Error(m) }

  // 지수: ^2, ^-1, ^0.5, ^(1/2), ^(-3)
  function parseExponent() {
    if (peek()?.t === '(') {
      pos++
      const v = parseSignedNumber()
      let r = v
      if (peek()?.t === '/') { pos++; r = v / parseSignedNumber() }
      if (peek()?.t !== ')') fail("지수의 괄호를 닫아야 해요")
      pos++
      return r
    }
    return parseSignedNumber()
  }
  function parseSignedNumber() {
    let sign = 1
    while (peek()?.t === 'sign') { sign *= peek().v; pos++ }
    if (peek()?.t !== 'num') fail('지수가 숫자가 아니에요')
    return sign * toks[pos++].v
  }
  function parseAtom() {
    const k = peek()
    if (!k) fail('단위가 중간에 끊겼어요')
    if (k.t === 'sym') {
      pos++
      const l = lookup(k.v)
      if (!l.known) unknown.push(k.v)
      return { dim: l.dim, atoms: l.atoms, scale: l.scale }
    }
    if (k.t === 'num') {
      pos++
      if (k.v !== 1) fail("단위 앞의 숫자는 1/s 처럼 1만 쓸 수 있어요")
      return DIMLESS
    }
    if (k.t === '(') {
      pos++
      const q = parseExpr()
      if (peek()?.t !== ')') fail('괄호를 닫아야 해요')
      pos++
      return q
    }
    return fail(`뜻밖의 '${k.t}'`)
  }
  function parsePow() {
    let q = parseAtom()
    if (peek()?.t === '^') {
      pos++
      q = powQ(q, parseExponent())
    }
    return q
  }
  function parseExpr() {
    let q = parsePow()
    for (;;) {
      const k = peek()
      if (!k) break
      if (k.t === '*') { pos++; q = mulQ(q, parsePow()) }
      else if (k.t === '/') { pos++; q = divQ(q, parsePow()) }
      else if (k.t === 'sym' || k.t === 'num' || k.t === '(') q = mulQ(q, parsePow()) // 공백으로 곱: "m s^-1"
      else break
    }
    return q
  }

  try {
    const q = parseExpr()
    if (pos < toks.length) fail('단위 뒤에 읽을 수 없는 부분이 있어요')
    return { ok: true, q, unknown }
  } catch (e) {
    return { ok: false, message: e.message }
  }
}
