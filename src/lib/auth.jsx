// 로그인 상태를 앱 전체에서 쓸 수 있게 해 주는 부분.
// Supabase 가 돌려주는 세션(session)이 있으면 로그인한 상태이다.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // 새로고침 직후에는 저장된 로그인 정보를 읽는 동안 "아직 모름" 상태다.
  // 이때 곧바로 로그인 화면으로 보내면 이미 로그인한 사람도 깜빡 튕기므로 따로 구분한다.
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 로그인·로그아웃·토큰 갱신이 일어날 때마다 알려준다.
    // (콜백 안에서 다시 supabase 를 호출하면 멈추는 문제가 있어서 상태만 바꾼다)
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
