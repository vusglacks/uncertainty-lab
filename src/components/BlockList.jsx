import { BLOCK_LABELS, namesAbove } from '../lib/blocks'
import MeasureBlock from './blocks/MeasureBlock'
import CalcBlock from './blocks/CalcBlock'
import GraphBlock from './blocks/GraphBlock'

const VIEWS = { measure: MeasureBlock, calc: CalcBlock, graph: GraphBlock }

// 블록들을 순서대로 그린다. 각 블록에 이동·삭제 조작을 붙인다.
export default function BlockList({ blocks, angleUnit, onChange, onMove, onRemove }) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
        아래에서 블록을 추가하세요.
      </p>
    )
  }

  return blocks.map((block, index) => {
    const View = VIEWS[block.type]
    return (
      <div key={block.id} className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {BLOCK_LABELS[block.type]}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <button
              onClick={() => onMove(index, -1)}
              disabled={index === 0}
              className="px-1 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
              title="위로"
            >
              ↑
            </button>
            <button
              onClick={() => onMove(index, 1)}
              disabled={index === blocks.length - 1}
              className="px-1 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400"
              title="아래로"
            >
              ↓
            </button>
            <button
              onClick={() => onRemove(block.id)}
              className="px-1 hover:text-red-600"
              title="삭제"
            >
              ✕
            </button>
          </div>
        </div>
        <View
          block={block}
          namesAbove={namesAbove(blocks, index)}
          blocksAbove={blocks.slice(0, index)}
          angleUnit={angleUnit}
          onChange={(patch) => onChange(index, patch)}
        />
      </div>
    )
  })
}
