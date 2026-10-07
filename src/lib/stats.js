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
//   uBGiven   : B형을 입력했는지
//   typeBError: B형 입력이 잘못됐을 때 메시지
//   uC        : 합성표준불확도 (계산할 수 없으면 null)
//     - A형·B형 둘 다 있으면 √(uA²+uB²)
//     - A형만 있으면 uA (uB = 0)
//     - 값이 1개라 A형이 없고 B형만 있으면 uB
//     - 그 외(불확도 정보가 전혀 없음, B형 입력 오류)는 null
export function measureStats(block) {
  const { values, invalid } = parseValues(block.rawText)
  const b = parseTypeB(block.typeB)
  const uA = typeAUncertainty(values)

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
    uC,
  }
}

// 화면 표시용 숫자 문자열. 부동소수점 찌꺼기(1.0003333333333333)를 유효숫자 6자리로 정리한다.
export function formatNumber(x) {
  if (x === null || x === undefined || !isFinite(x)) return '-'
  return String(Number(x.toPrecision(6)))
}
