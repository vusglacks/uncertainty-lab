// 지금 쓰는 저장소(로그인했으면 Supabase, 아니면 이 브라우저)를 화면들에 알려 주는 부분.
// 화면은 useStorage() 로 받아서 listExperiments() 같은 함수를 부르기만 하면 된다.
import { createContext, useContext, useMemo } from 'react'
import { cloudStorage } from './storage'
import { guestStorage } from './guestStorage'

const StorageContext = createContext(null)

// mode: 'cloud' (로그인함) | 'guest' (로그인 없이)
export function StorageProvider({ mode, children }) {
  const value = useMemo(() => ({ mode, ...(mode === 'cloud' ? cloudStorage : guestStorage()) }), [mode])
  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useStorage() {
  return useContext(StorageContext)
}
