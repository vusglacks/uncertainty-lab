import { BLOCK_LABELS } from '../lib/blocks'

// 블록 추가 — 목록 맨 아래에 종류를 골라 넣는다.
export default function AddBlockButton({ onAdd }) {
  return (
    <div className="flex gap-2">
      {Object.entries(BLOCK_LABELS).map(([type, label]) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + {label}
        </button>
      ))}
    </div>
  )
}
