// 수식에서 쓸 수 있는 함수·상수 안내 (화면에 보여주는 도움말)
// 실제로 계산하는 곳은 engine.js 이고, 여기와 어긋나지 않는지는 test/funcs.test.js 가 확인한다.
export const FUNCTION_GROUPS = [
  { title: '삼각함수', names: ['sin', 'cos', 'tan'], note: '각도는 편집 화면의 "각도 단위"(도/라디안)를 따라요' },
  { title: '역삼각함수', names: ['asin', 'acos', 'atan'], note: '결과도 "각도 단위"로 나와요 (도이면 °)' },
  { title: '쌍곡함수', names: ['sinh', 'cosh', 'tanh'], note: '' },
  { title: '지수·로그', names: ['exp', 'ln', 'log', 'log2'], note: 'ln = 자연로그(밑 e), log = 상용로그(밑 10), log2 = 밑 2' },
  { title: '거듭제곱근·절댓값', names: ['sqrt', 'cbrt', 'abs'], note: 'sqrt = 제곱근, cbrt = 세제곱근' },
]

export const CONSTANTS = ['pi', 'e']

// 한 줄 요약 (식 입력칸 아래에 항상 보여준다)
export const FUNCTION_SUMMARY =
  '함수: sin cos tan asin acos atan sinh cosh tanh exp ln log log2 sqrt cbrt abs · 상수: pi e · log 는 상용로그(밑 10), 자연로그는 ln'
