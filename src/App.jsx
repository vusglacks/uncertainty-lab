// 1차시: 개발 환경이 동작하는지 확인하는 임시 화면.
// 2차시부터 시작 화면 / 편집 화면을 실제로 만든다.

const 차시 = [
  ['1', 'GitHub 저장소, 개발 환경, 화면·블록 구조 확정', true],
  ['2', '시작 화면과 편집 화면 뼈대 (블록 추가·삭제·이동)', false],
  ['3', '측정 블록 — 통계와 표준불확도', false],
  ['4', '계산 블록 — 자동 미분과 오차 전파 (engine.js 이식)', false],
  ['5', '그래프 블록과 내보내기, Vercel 첫 배포', false],
  ['6', 'Supabase 생성, 로그인, 테이블 설계', false],
  ['7', '실험 파일 저장', false],
  ['8', '저장한 파일 불러오기, 최종 점검', false],
]

function App() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">
        실험 데이터 처리 및 불확도 자동 계산
      </h1>
      <p className="mt-2 text-slate-600">
        대전과학고 정보과학 프로젝트 · 2307 송하율
      </p>

      <ol className="mt-10 space-y-2">
        {차시.map(([n, 목표, 완료]) => (
          <li
            key={n}
            className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${
              완료
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span className="font-mono font-semibold">{n}</span>
            <span>{목표}</span>
            {완료 && <span className="ml-auto">✓</span>}
          </li>
        ))}
      </ol>

      <p className="mt-10 text-xs text-slate-400">
        이 화면이 보이고 위 카드에 색이 입혀져 있으면 Vite + React + Tailwind 설정이 끝난 것.
      </p>
    </main>
  )
}

export default App
