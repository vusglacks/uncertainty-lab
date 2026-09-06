// 블록을 만들고 다루는 도우미 함수들.
import { uid } from './id'

export const BLOCK_LABELS = {
  measure: '측정 블록',
  calc: '계산 블록',
  graph: '그래프 블록',
}

// 새 블록 한 개를 기본값과 함께 만든다.
export function newBlock(type) {
  const base = { id: uid(), type, name: '' }
  if (type === 'measure') return { ...base, unit: '', rawText: '', typeB: '' }
  if (type === 'calc') return { ...base, formula: '' }
  if (type === 'graph') return { ...base, name: undefined, xName: '', yName: '', fit: 'linear' }
  throw new Error('알 수 없는 블록 종류: ' + type)
}

// 특정 블록보다 "위에 있는" 블록들의 이름 목록.
// 계산 블록은 이 이름만 변수로 쓸 수 있다 (순환 참조 방지).
export function namesAbove(blocks, index) {
  return blocks
    .slice(0, index)
    .map((b) => b.name)
    .filter((n) => n && n.trim())
}

// 실험 전체에서 중복된 이름 목록. (편집 화면에서 경고 표시용)
export function duplicateNames(blocks) {
  const seen = new Map()
  for (const b of blocks) {
    const n = (b.name || '').trim()
    if (!n) continue
    seen.set(n, (seen.get(n) || 0) + 1)
  }
  return [...seen].filter(([, count]) => count > 1).map(([n]) => n)
}

// 수식 문자열에서 변수 이름 oldName을 newName으로 바꾼다.
// 단어 경계로만 바꿔서 'L'이 'ln' 같은 글자에 안 걸리도록 한다.
export function renameInFormula(formula, oldName, newName) {
  if (!oldName) return formula
  const re = new RegExp(`(^|[^A-Za-z0-9_가-힣])${escapeRe(oldName)}(?![A-Za-z0-9_가-힣])`, 'g')
  return formula.replace(re, (_, before) => before + newName)
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
