import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listExperiments, saveExperiment, deleteExperiment } from '../lib/storage'
import { listLocalExperiments, removeLocalExperiment } from '../lib/localImport'
import { useAuth } from '../lib/auth'
import { uid } from '../lib/id'
import ConfirmDialog from '../components/ConfirmDialog'

// 시작 화면 — 내 실험 목록, 새 실험 만들기, 검색, 로그아웃.
export default function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [experiments, setExperiments] = useState(null) // null = 아직 불러오는 중
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null) // { id, title } | null
  const [localCount, setLocalCount] = useState(() => listLocalExperiments().length)

  async function reload() {
    setLoadError('')
    try {
      setExperiments(await listExperiments())
    } catch (e) {
      setLoadError(e.message)
    }
  }

  // 화면을 처음 열 때 한 번 목록을 불러온다. (그 사이 화면을 떠나면 결과는 버린다)
  useEffect(() => {
    let cancelled = false
    listExperiments()
      .then((list) => !cancelled && setExperiments(list))
      .catch((e) => !cancelled && setLoadError(e.message))
    return () => {
      cancelled = true
    }
  }, [])

  const shown = (experiments ?? []).filter((e) => e.title.toLowerCase().includes(query.trim().toLowerCase()))

  async function createExperiment() {
    setActionError('')
    setBusy(true)
    const now = new Date().toISOString()
    const exp = { id: uid(), title: '새 실험', createdAt: now, updatedAt: now, angleUnit: 'deg', blocks: [] }
    try {
      await saveExperiment(exp)
      navigate(`/exp/${exp.id}`)
    } catch (e) {
      setActionError(e.message)
      setBusy(false)
    }
  }

  async function confirmRemove() {
    const { id } = pendingDelete
    setPendingDelete(null)
    setActionError('')
    try {
      await deleteExperiment(id)
      setExperiments((list) => list.filter((e) => e.id !== id))
    } catch (e) {
      setActionError(e.message)
    }
  }

  // 로그인 기능 전에 이 브라우저에 저장해 둔 실험을 내 계정으로 옮긴다.
  // 새 id 로 저장해서 다른 계정과 id 가 겹치지 않게 하고, 성공한 것만 하나씩 지운다.
  async function importLocal() {
    setActionError('')
    setBusy(true)
    try {
      for (const old of listLocalExperiments()) {
        await saveExperiment({
          id: uid(),
          title: old.title || '가져온 실험',
          angleUnit: old.angleUnit === 'rad' ? 'rad' : 'deg',
          blocks: old.blocks ?? [],
        })
        removeLocalExperiment(old.id)
      }
      await reload()
    } catch (e) {
      setActionError(`가져오는 중 문제가 생겼어요(성공한 것까지는 옮겨졌어요). ${e.message}`)
    }
    setLocalCount(listLocalExperiments().length)
    setBusy(false)
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">내 실험</h1>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{user?.email}</span>
          <button onClick={signOut} className="underline hover:text-slate-800">
            로그아웃
          </button>
        </div>
      </div>

      {localCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span className="flex-1">
            이 브라우저에만 저장돼 있던 실험이 {localCount}개 있어요. 내 계정으로 가져올까요?
          </span>
          <button
            onClick={importLocal}
            disabled={busy}
            className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            가져오기
          </button>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="실험 제목 검색"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={createExperiment}
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          새 실험 만들기
        </button>
      </div>

      {actionError && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{actionError}</p>}

      {loadError ? (
        <div className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}{' '}
          <button onClick={reload} className="underline">
            다시 시도
          </button>
        </div>
      ) : experiments === null ? (
        <p className="mt-6 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {shown.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
              {experiments.length === 0
                ? '아직 실험이 없어요. “새 실험 만들기”를 눌러 시작하세요.'
                : '검색 결과가 없어요.'}
            </li>
          )}
          {shown.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3"
            >
              <button onClick={() => navigate(`/exp/${e.id}`)} className="flex-1 text-left">
                <div className="text-sm font-medium text-slate-900">{e.title}</div>
                <div className="text-xs text-slate-400">
                  수정 {new Date(e.updatedAt).toLocaleString('ko-KR')} · 블록 {e.blocks.length}개
                </div>
              </button>
              <button
                onClick={() => setPendingDelete({ id: e.id, title: e.title })}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        message={`"${pendingDelete?.title}" 실험을 삭제할까요? 되돌릴 수 없어요.`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
      />
    </main>
  )
}
