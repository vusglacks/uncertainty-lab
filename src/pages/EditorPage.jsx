import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getExperiment, saveExperiment } from '../lib/storage'
import { newBlock, duplicateNames, renameInFormula, isNameUsedElsewhere } from '../lib/blocks'
import BlockList from '../components/BlockList'
import AddBlockButton from '../components/AddBlockButton'
import ConfirmDialog from '../components/ConfirmDialog'

// 편집 화면 — 블록을 위에서 아래로 쌓아 계산한다.
export default function EditorPage() {
  const { id } = useParams()
  const [exp, setExp] = useState(() => getExperiment(id))
  const [pendingRemove, setPendingRemove] = useState(null) // { blockId, name } | null

  // update()로 실제 편집이 일어났을 때만 저장한다. "마운트 시 한 번은 건너뛴다" 방식은
  // 개발 모드 StrictMode가 effect를 일부러 두 번 실행하면서 깨졌다(두 번째 실행 때 저장돼버림).
  // 그래서 "마운트 여부"가 아니라 "실제로 고쳤는지"를 직접 기록한다.
  const dirty = useRef(false)
  useEffect(() => {
    if (dirty.current && exp) saveExperiment(exp)
  }, [exp])

  if (!exp) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-slate-500">실험을 찾을 수 없어요.</p>
        <Link to="/" className="text-sm text-slate-900 underline">
          목록으로
        </Link>
      </main>
    )
  }

  const update = (patch) => {
    dirty.current = true
    setExp((prev) => ({ ...prev, ...patch }))
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

  // 블록 한 개를 수정. 이름이 바뀌면 아래 계산 블록의 수식도 함께 고친다.
  function updateBlock(index, patch) {
    const prev = exp.blocks[index]
    const next = exp.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b))
    if ('name' in patch && patch.name !== prev.name && prev.name) {
      for (let i = index + 1; i < next.length; i++) {
        if (next[i].type === 'calc') {
          next[i] = {
            ...next[i],
            formula: renameInFormula(next[i].formula, prev.name, patch.name),
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
        <Link
          to={`/exp/${exp.id}/export`}
          className="text-slate-400 hover:text-slate-700"
        >
          내보내기
        </Link>
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
