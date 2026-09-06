import { Link, useParams } from 'react-router-dom'

// 내보내기 화면 — 표 복사, 그래프 이미지 저장. (5차시에 구현)
export default function ExportPage() {
  const { id } = useParams()
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to={`/exp/${id}`} className="text-sm text-slate-400 hover:text-slate-700">
        ← 편집으로
      </Link>
      <h1 className="mt-4 text-xl font-bold text-slate-900">내보내기</h1>
      <p className="mt-2 text-sm text-slate-500">
        표 복사와 그래프 이미지 저장은 5차시에 만든다.
      </p>
    </main>
  )
}
