import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExperiment, saveExperiment } from '../lib/storage'
import { newBlock, duplicateNames, renameInFormula, isNameUsedElsewhere } from '../lib/blocks'
import BlockList from '../components/BlockList'
import AddBlockButton from '../components/AddBlockButton'
import ConfirmDialog from '../components/ConfirmDialog'

// 글자를 칠 때마다 서버에 저장하면 낭비라서, 마지막 수정 뒤 이만큼(ms) 조용하면 한 번에 저장한다.
const SAVE_DELAY = 800

// 편집 화면 — 블록을 위에서 아래로 쌓아 계산한다. 원본(제목·블록)만 서버에 자동 저장한다.
export default function EditorPage() {
  const { id } = useParams()
  const [exp, setExp] = useState(null)
  const [loadState, setLoadState] = useState('loading') // 'loading' | 'ready' | 'notfound' | 'error'
  const [loadError, setLoadError] = useState('')
  const [loadTry, setLoadTry] = useState(0)
  const [saveState, setSaveState] = useState('saved') // 'saved' | 'dirty' | 'saving' | 'error'
  const [saveError, setSaveError] = useState('')
  const [pendingRemove, setPendingRemove] = useState(null) // { blockId, name } | null

  // 저장 관련 값은 화면을 다시 그릴 필요가 없어서 ref 에 둔다.
  const latest = useRef(null) // 가장 최근 실험 내용
  const dirty = useRef(false) // 아직 저장 안 된 수정이 있는지
  const inFlight = useRef(false) // 지금 저장 요청이 진행 중인지
  const timer = useRef(null)

  // 실험 불러오기
  useEffect(() => {
    let cancelled = false
    getExperiment(id)
      .then((e) => {
        if (cancelled) return
        if (e) {
          setExp(e)
          setLoadState('ready')
        } else {
          setLoadState('notfound')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err.message)
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [id, loadTry])

  useEffect(() => {
    latest.current = exp
  }, [exp])

  // 저장하지 않은 수정을 서버에 보낸다. 이미 저장 중이면 끝난 뒤에 다시 확인한다.
  async function flush() {
    clearTimeout(timer.current)
    if (inFlight.current || !dirty.current || !latest.current) return
    inFlight.current = true
    dirty.current = false
    setSaveState('saving')
    try {
      await saveExperiment(latest.current)
    } catch (e) {
      dirty.current = true
      inFlight.current = false
      setSaveError(e.message)
      setSaveState('error')
      return
    }
    inFlight.current = false
    if (dirty.current) {
      schedule() // 저장하는 동안 또 고쳤다면 한 번 더
    } else {
      setSaveState('saved')
    }
  }

  function schedule() {
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  // 화면을 떠날 때(목록으로 이동 등) 아직 안 보낸 수정이 있으면 바로 저장한다.
  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      if (dirty.current && !inFlight.current) flush()
    }
  }, [])

  // 저장 전에 탭을 닫으려 하면 브라우저가 경고하게 한다.
  useEffect(() => {
    function warn(e) {
      if (dirty.current || inFlight.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  if (loadState === 'loading') {
    return <p className="px-6 py-12 text-center text-sm text-slate-400">불러오는 중…</p>
  }

  if (loadState === 'error') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{loadError}</p>
        <button onClick={() => { setLoadState('loading'); setLoadTry((n) => n + 1) }} className="mt-3 underline">
          다시 시도
        </button>
        <Link to="/" className="ml-4 text-slate-500 underline">
          목록으로
        </Link>
      </main>
    )
  }

  if (loadState === 'notfound') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-slate-500">실험을 찾을 수 없어요. (내 계정의 실험이 아니거나 삭제됐을 수 있어요)</p>
        <Link to="/" className="text-sm text-slate-900 underline">
          목록으로
        </Link>
      </main>
    )
  }

  // 모든 수정은 여기를 거친다: 수정 표시를 남기고 저장 예약을 건다.
  const update = (patch) => {
    dirty.current = true
    setSaveState('dirty')
    setExp((prev) => ({ ...prev, ...patch }))
    schedule()
  }

  function addBlock(type) {
    update({ blocks: [...exp.blocks, newBlock(type)] })
  }

  function removeBlock(blockId) {
    const block = exp.blocks.find((b) => b.id === blockId)
    if (block && isNameUsedElsewhere(exp.blocks, block)) {
      setPendingRemove({ blockId, name: block.name })
      return
    }
    update({ blocks: exp.blocks.filter((b) => b.id !== blockId) })
  }

  function confirmRemoveBlock() {
    update({ blocks: exp.blocks.filter((b) => b.id !== pendingRemove.blockId) })
    setPendingRemove(null)
  }

  function moveBlock(index, dir) {
    const j = index + dir
    if (j < 0 || j >= exp.blocks.length) return
    const next = [...exp.blocks]
    ;[next[index], next[j]] = [next[j], next[index]]
    update({ blocks: next })
  }

  // 블록 한 개를 수정. 이름이 바뀌면 아래 계산 블록의 수식과 그래프 블록의 축 이름도 함께 고친다.
  // 이름을 지워서 빈 칸이 된 순간에는 따라 바꾸지 않는다. (바꾸면 수식에서 이름이 사라져 버린다.
  // 이 경우 수식은 옛 이름 그대로 두고, "존재하지 않는 이름" 경고가 뜬다)
  function updateBlock(index, patch) {
    const prev = exp.blocks[index]
    const next = exp.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b))
    if ('name' in patch && patch.name !== prev.name && prev.name && patch.name.trim()) {
      for (let i = index + 1; i < next.length; i++) {
        const b = next[i]
        if (b.type === 'calc') {
          next[i] = { ...b, formula: renameInFormula(b.formula, prev.name, patch.name) }
        } else if (b.type === 'graph') {
          next[i] = {
            ...b,
            xName: b.xName === prev.name ? patch.name : b.xName,
            yName: b.yName === prev.name ? patch.name : b.yName,
          }
        }
      }
    }
    update({ blocks: next })
  }

  const dups = duplicateNames(exp.blocks)

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3 text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-700">
          ← 목록
        </Link>
        <span className="text-slate-300">|</span>
        <Link to={`/exp/${exp.id}/export`} className="text-slate-400 hover:text-slate-700">
          내보내기
        </Link>
        <SaveStatus state={saveState} error={saveError} onRetry={flush} />
      </div>

      <input
        value={exp.title}
        onChange={(e) => update({ title: e.target.value })}
        className="mt-4 w-full border-0 border-b border-transparent text-2xl font-bold text-slate-900 focus:border-slate-300 focus:outline-none"
      />

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        각도 단위
        <select
          value={exp.angleUnit}
          onChange={(e) => update({ angleUnit: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1"
        >
          <option value="deg">도 (°)</option>
          <option value="rad">라디안</option>
        </select>
      </label>

      {dups.length > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          이름이 겹쳐요: {dups.join(', ')}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <BlockList
          blocks={exp.blocks}
          angleUnit={exp.angleUnit}
          onChange={updateBlock}
          onMove={moveBlock}
          onRemove={removeBlock}
        />
        <AddBlockButton onAdd={addBlock} />
      </div>

      <ConfirmDialog
        open={!!pendingRemove}
        message={`"${pendingRemove?.name}" 이름을 다른 블록이 쓰고 있어요. 그래도 삭제할까요?`}
        onCancel={() => setPendingRemove(null)}
        onConfirm={confirmRemoveBlock}
      />
    </main>
  )
}

// 화면 위쪽에 보이는 저장 상태 표시
function SaveStatus({ state, error, onRetry }) {
  if (state === 'error') {
    return (
      <span className="ml-auto text-xs text-amber-700">
        저장 실패 — {error}{' '}
        <button onClick={onRetry} className="underline">
          다시 시도
        </button>
      </span>
    )
  }
  const label = { saved: '저장됨', dirty: '저장 대기…', saving: '저장 중…' }[state]
  return <span className="ml-auto text-xs text-slate-400">{label}</span>
}
