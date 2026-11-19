// ============================================================
//  측정 블록의 통계 계산 (화면 코드와 분리한 순수 함수들)
//  1) parseValues   : 붙여넣은 텍스트 -> 숫자 배열
//  2) 평균, 표본표준편차(n-1), A형 표준불확도
//  3) B형 불확도 해석, 합성표준불확도
//  4) measureStats  : 측정 블록 하나의 모든 결과를 한 번에
// ============================================================

// 숫자 모양만 허용한다. (Number()는 '0x10', 'Infinity' 같은 것도 받아줘서 직접 검사)
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

// 붙여넣은 텍스트에서 숫자를 뽑는다.
// 엑셀에서 복사하면 줄은 줄바꿈(\n, \r\n), 칸은 탭(\t)으로 구분돼 온다.
// 그래서 공백·탭·줄바꿈·쉼표·세미콜론을 모두 구분자로 본다.
// 숫자가 아닌 조각(예: 열 제목 "길이(m)")은 버리지 않고 invalid 로 따로 돌려줘서
// 화면에서 "이건 무시했어요" 하고 알려줄 수 있게 한다.
export function parseValues(text) {
  const tokens = String(text ?? '')
    .replace(/−/g, '-') // 엑셀·워드가 쓰는 유니코드 마이너스(−)를 일반 마이너스로
    .split(/[\s,;]+/)
    .filter(Boolean)

  const values = []
  const invalid = []
  for (const t of tokens) {
    if (NUMBER_RE.test(t)) values.push(Number(t))
    else invalid.push(t)
  }
  return { values, invalid }
}

// 산술평균 = (x1 + x2 + ... + xn) / n.  값이 없으면 null.
export function mean(values) {
  if (values.length === 0) return null
  return values.reduce((s, x) => s + x, 0) / values.length
}

// 표본표준편차 s = √( Σ(xi - 평균)² / (n-1) )   (엑셀 STDEV.S 와 같은 값)
// n-1 로 나누는 이유: 평균을 이미 데이터에서 구했기 때문에 자유도가 하나 줄어든다.
// 값이 1개면 n-1 = 0 이라 계산할 수 없으므로 null.
// 평균을 먼저 구한 뒤 편차를 제곱해 더하는 2단계 방식이 수치적으로 안정적이다.
export function sampleStd(values) {
  const n = values.length
  if (n < 2) return null
  const m = mean(values)
  const sumSq = values.reduce((s, x) => s + (x - m) ** 2, 0)
  return Math.sqrt(sumSq / (n - 1))
}

// A형 표준불확도 u_A = s / √n  (= 평균의 표준편차)
// 측정을 여러 번 반복해 평균을 내면 평균의 흔들림은 개별 측정보다 √n 배 작아진다.
export function typeAUncertainty(values) {
  const s = sampleStd(values)
  if (s === null) return null
  return s / Math.sqrt(values.length)
}

// B형 불확도 입력칸 해석. 빈칸이면 "입력 안 함"(0)으로 본다.
// 반환: { value, given, error }
export function parseTypeB(text) {
  const t = String(text ?? '').trim()
  if (t === '') return { value: 0, given: false, error: null }
  if (!NUMBER_RE.test(t) || Number(t) < 0) {
    return { value: 0, given: false, error: 'B형 불확도는 0 이상의 숫자로 입력하세요' }
  }
  return { value: Number(t), given: true, error: null }
}

// ---------- B형 요인 ----------
// B형 불확도는 보통 여러 요인이 합쳐진 것이다 (눈금을 읽는 한계, 기기 자체의 오차, 교정 성적서 …).
// 요인마다 "표준불확도 u" 로 바꿔서 제곱합의 루트로 합친다: u_B = √(u₁² + u₂² + …)
//
// 요인 종류와 표준불확도로 바꾸는 방법 (GUM 의 관례)
//   resolution  분해능 δ (눈금 한 칸). 읽을 때 ±δ/2 안에서 고르게 퍼진다고 보고 u = (δ/2)/√3 = δ/(2√3)
//   rect        기기 오차한계 ±a. 범위 안에서 고르게 퍼짐(직사각형 분포)이라고 보고 u = a/√3
//   tri         기기 오차한계 ±a. 가운데에 몰려 있음(삼각 분포)이라고 보고 u = a/√6
//   ext         교정 성적서의 확장불확도 U 와 포함인자 k (보통 k = 2). u = U/k
//   std         이미 표준불확도인 값. u 그대로
export const B_KINDS = [
  { id: 'resolution', label: '분해능', valueLabel: '분해능 δ (눈금 한 칸)', formula: 'u = δ / (2√3)', convert: (v) => v / (2 * Math.sqrt(3)) },
  { id: 'rect', label: '기기 오차한계 (직사각형)', valueLabel: '오차한계 ±a', formula: 'u = a / √3', convert: (v) => v / Math.sqrt(3) },
  { id: 'tri', label: '기기 오차한계 (삼각)', valueLabel: '오차한계 ±a', formula: 'u = a / √6', convert: (v) => v / Math.sqrt(6) },
  { id: 'ext', label: '확장불확도 (성적서)', valueLabel: '확장불확도 U', formula: 'u = U / k', convert: (v, k) => v / k },
  { id: 'std', label: '표준불확도 (직접)', valueLabel: '표준불확도 u', formula: 'u = 입력값', convert: (v) => v },
]
const KIND_BY_ID = Object.fromEntries(B_KINDS.map((k) => [k.id, k]))
export const DEFAULT_K = 2

// B형 요인 목록을 해석한다.
//   factors: [{ id, label, kind, value, k }]  (value, k 는 입력한 글자 그대로)
// 값 칸이 비어 있는 요인은 "아직 안 쓴 줄"로 보고 건너뛴다.
// 반환: { list, given, u, error }
//   list : [{ ...요인, u, used }]  요인마다 표준불확도 u (안 쓴 줄은 used:false)
//   given: 쓴 요인이 하나라도 있는지
//   u    : 합성 √(Σu²)
//   error: 잘못 입력한 요인이 있으면 어느 요인인지 알려주는 메시지
export function parseBFactors(factors) {
  const list = []
  let error = null
  let sumSq = 0
  let given = false
  for (const f of Array.isArray(factors) ? factors : []) {
    const name = f.label?.trim() || KIND_BY_ID[f.kind]?.label || 'B형 요인'
    const text = String(f.value ?? '').trim()
    if (text === '') {
      list.push({ ...f, u: 0, used: false })
      continue
    }
    const kind = KIND_BY_ID[f.kind]
    if (!kind) {
      error ??= `B형 요인 '${name}' 의 종류를 알 수 없어요`
      list.push({ ...f, u: 0, used: false })
      continue
    }
    if (!NUMBER_RE.test(text) || Number(text) < 0) {
      error ??= `B형 요인 '${name}' 의 값은 0 이상의 숫자로 입력하세요`
      list.push({ ...f, u: 0, used: false })
      continue
    }
    let k = 1
    if (f.kind === 'ext') {
      const kt = String(f.k ?? '').trim()
      k = kt === '' ? DEFAULT_K : Number(kt)
      if (kt !== '' && (!NUMBER_RE.test(kt) || !(k > 0))) {
        error ??= `B형 요인 '${name}' 의 포함인자 k 는 0보다 큰 숫자로 입력하세요`
        list.push({ ...f, u: 0, used: false })
        continue
      }
    }
    const u = kind.convert(Number(text), k)
    sumSq += u * u
    given = true
    list.push({ ...f, u, used: true })
  }
  return { list, given, u: Math.sqrt(sumSq), error }
}

// 합성표준불확도 u_c = √(u_A² + u_B²)
// A형과 B형이 서로 독립이라고 보고 제곱해서 더한 뒤 루트를 씌운다.
export function combinedUncertainty(uA, uB) {
  return Math.sqrt(uA ** 2 + uB ** 2)
}

// 측정 블록 하나의 통계 결과를 모두 계산한다.
//   n         : 유효한 측정값 개수
//   mean      : 평균 (값이 없으면 null)
//   std       : 표본표준편차 (n<2 이면 null)
//   uA        : A형 표준불확도 (n<2 이면 null)
//   uB        : B형 표준불확도 (입력 안 했으면 0)
//                 직접 입력한 B형(typeB)과 B형 요인들을 √(제곱합)으로 합친 값
//   uBGiven   : B형을 입력했는지 (직접 입력 또는 요인)
//   typeBError: B형 입력이 잘못됐을 때 메시지 (직접 입력 또는 요인)
//   bFactors  : B형 요인별 표준불확도 목록 (화면 표시용)
//   uC        : 합성표준불확도 (계산할 수 없으면 null)
//     - A형·B형 둘 다 있으면 √(uA²+uB²)
//     - A형만 있으면 uA (uB = 0)
//     - 값이 1개라 A형이 없고 B형만 있으면 uB
//     - 그 외(불확도 정보가 전혀 없음, B형 입력 오류)는 null
export function measureStats(block) {
  const { values, invalid } = parseValues(block.rawText)
  const direct = parseTypeB(block.typeB) // 예전부터 있던 "B형 표준불확도" 한 칸
  const f = parseBFactors(block.bFactors) // 새로 나눠 입력하는 B형 요인들 (없으면 빈 목록)
  const uA = typeAUncertainty(values)

  const b = {
    value: Math.sqrt(direct.value ** 2 + f.u ** 2), // 직접 입력과 요인들도 서로 독립이라 제곱해서 합친다
    given: direct.given || f.given,
    error: direct.error || f.error,
  }

  let uC = null
  if (!b.error) {
    if (uA !== null) uC = combinedUncertainty(uA, b.value)
    else if (b.given && values.length >= 1) uC = b.value
  }

  return {
    n: values.length,
    values,
    invalid,
    mean: mean(values),
    std: sampleStd(values),
    uA,
    uB: b.value,
    uBGiven: b.given,
    typeBError: b.error,
    bDirect: direct.given ? direct.value : null, // 직접 입력한 B형 (없으면 null)
    bFactors: f.list,
    uC,
  }
}

// 화면 표시용 숫자 문자열. 부동소수점 찌꺼기(1.0003333333333333)를 유효숫자 6자리로 정리한다.
export function formatNumber(x) {
  if (x === null || x === undefined || !isFinite(x)) return '-'
  return String(Number(x.toPrecision(6)))
}
