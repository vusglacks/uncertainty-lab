import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listExperiments, saveExperiment, deleteExperiment } from '../lib/storage'
import { uid } from '../lib/id'

// 시작 화면 — 내 실험 목록, 새 실험 만들기, 검색.
export default function HomePage() {
  const navigate = useNavigate()
  const [experiments, setExperiments] = useState(listExperiments)
  const [query, setQuery] = useState('')

  const shown = experiments
    .filter((e) => e.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function createExperiment() {
    const now = new Date().toISOString()
    const exp = {
      id: uid(),
      title: '새 실험',
      createdAt: now,
      updatedAt: now,
      angleUnit: 'deg',
      blocks: [],
    }
    saveExperiment(exp)
    navigate(`/exp/${exp.id}`)
  }

  function remove(id) {
    deleteExperiment(id)
    setExperiments(listExperiments())
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-xl font-bold text-slate-900">내 실험</h1>

      <div className="mt-6 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="실험 제목 검색"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={createExperiment}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          새 실험 만들기
        </button>
      </div>

      <ul className="mt-6 space-y-2">
        {shown.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            아직 실험이 없어요. “새 실험 만들기”를 눌러 시작하세요.
          </li>
        )}
        {shown.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
          >
            <button
              onClick={() => navigate(`/exp/${e.id}`)}
              className="flex-1 text-left"
            >
              <div className="text-sm font-medium text-slate-900">{e.title}</div>
              <div className="text-xs text-slate-400">
                수정 {new Date(e.updatedAt).toLocaleString('ko-KR')} · 블록 {e.blocks.length}개
              </div>
            </button>
            <button
              onClick={() => remove(e.id)}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
