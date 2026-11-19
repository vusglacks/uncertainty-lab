// 로그인 없이 쓸 때의 저장소 — 이 브라우저의 localStorage 에 실험을 저장한다.
// 로그인했을 때 쓰는 Supabase 저장소(storage.js)와 함수 이름과 모양이 같아서, 화면은 어느 쪽인지 몰라도 된다.
//
// localStorage 는 "이 브라우저 안에만 있는 작은 저장 공간"이다. 다른 기기에서는 보이지 않고,
// 브라우저의 사이트 데이터를 지우면 사라진다. 그래서 오래 두고 싶으면 로그인해서 계정에 저장하게 안내한다.
// 키 이름은 예전 1차 버전이 쓰던 것과 같아서, 로그인한 뒤 시작 화면의 "가져오기"가 그대로 옮겨 준다 (localImport.js).
const KEY = 'uncertainty-lab:experiments'

// store 는 localStorage 처럼 getItem/setItem 이 있는 것 (테스트에서는 가짜를 넣는다)
export function createGuestStorage(store = globalThis.localStorage) {
  function read() {
    try {
      const list = JSON.parse(store.getItem(KEY))
      return Array.isArray(list) ? list : []
    } catch {
      return [] // 저장된 글자가 깨졌거나 브라우저가 저장소를 막은 경우: 빈 목록으로 본다
    }
  }

  function write(list) {
    try {
      store.setItem(KEY, JSON.stringify(list))
    } catch {
      throw new Error('이 브라우저에 저장하지 못했어요. 저장 공간이 부족하거나 브라우저가 저장을 막고 있어요')
    }
  }

  // 예전 버전에 저장된 실험은 빠진 칸이 있을 수 있어서 기본값으로 채운다.
  function normalize(e) {
    const now = new Date().toISOString()
    return {
      id: e.id,
      title: e.title ?? '',
      angleUnit: e.angleUnit === 'rad' ? 'rad' : 'deg',
      blocks: Array.isArray(e.blocks) ? e.blocks : [],
      createdAt: e.createdAt ?? e.updatedAt ?? now,
      updatedAt: e.updatedAt ?? e.createdAt ?? now,
    }
  }

  return {
    // 전체 목록 (최근 수정순)
    async listExperiments() {
      return read()
        .map(normalize)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    },

    // 실험 하나. 없으면 null.
    async getExperiment(id) {
      const found = read().find((e) => e.id === id)
      return found ? normalize(found) : null
    },

    // 새 실험이면 추가, 있으면 덮어쓰기. 수정 시각은 저장할 때마다 갱신한다.
    async saveExperiment(exp) {
      const list = read()
      const now = new Date().toISOString()
      const i = list.findIndex((e) => e.id === exp.id)
      const createdAt = i >= 0 ? (list[i].createdAt ?? now) : (exp.createdAt ?? now)
      const next = { id: exp.id, title: exp.title, angleUnit: exp.angleUnit, blocks: exp.blocks, createdAt, updatedAt: now }
      if (i >= 0) list[i] = next
      else list.push(next)
      write(list)
    },

    async deleteExperiment(id) {
      write(read().filter((e) => e.id !== id))
    },
  }
}

// 앱 전체에서 쓰는 하나. (처음 쓸 때 만든다: 서버에서 렌더링하는 등 localStorage 가 없는 곳에서 불러만 와도 안전하게)
let shared = null
export function guestStorage() {
  shared ??= createGuestStorage()
  return shared
}
