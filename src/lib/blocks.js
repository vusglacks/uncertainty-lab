// 블록을 만들고 다루는 도우미 함수들.
import { uid } from './id'
import { parse, collectVars } from './engine'

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

// 수식에 쓰인 변수 중 지금 위 블록에서 찾을 수 없는 이름들.
// 이름을 바꾸거나 블록을 옮기면 수식이 옛 이름을 계속 가리킬 수 있어서, 그걸 잡아낸다.
// 수식이 아직 다 안 써져서 파싱이 안 되면(타이핑 중) 조용히 빈 배열 — 문법 검사는 4차시 몫.
export function unknownFormulaVars(formula, namesAvailable) {
  if (!formula || !formula.trim()) return []
  try {
    return collectVars(parse(formula)).filter((v) => !namesAvailable.includes(v))
  } catch {
    return []
  }
}

// 이 블록의 이름을 다른 블록(계산 블록 수식, 그래프 블록 축)이 쓰고 있는지.
// 블록을 지우기 전에 확인하는 용도.
export function isNameUsedElsewhere(blocks, block) {
  const name = block.name
  if (!name) return false
  return blocks.some((b) => {
    if (b.id === block.id) return false
    if (b.type === 'calc') {
      try {
        return collectVars(parse(b.formula)).includes(name)
      } catch {
        return false
      }
    }
    if (b.type === 'graph') return b.xName === name || b.yName === name
    return false
  })
}
