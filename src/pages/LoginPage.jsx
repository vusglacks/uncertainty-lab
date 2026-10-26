import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { authErrorMessage } from '../lib/authMessages'
import { SetupNeeded } from '../components/RequireAuth'

// 로그인 / 회원가입 화면. 이메일 + 비밀번호 방식.
export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!supabaseConfigured) return <SetupNeeded />
  if (loading) return <p className="px-6 py-12 text-center text-sm text-slate-400">불러오는 중…</p>
  const from = location.state?.from || '/'
  if (user) return <Navigate to={from} replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (mode === 'signup' && password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }
    setBusy(true)
    const { data, error: err } = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (err) {
      setError(authErrorMessage(err))
      return
    }
    // 가입 직후 세션이 없으면 "이메일 인증"이 켜져 있다는 뜻 — 메일 확인을 안내한다.
    if (mode === 'signup' && !data.session) {
      setNotice('가입 요청이 됐어요. 메일함의 인증 링크를 누른 뒤 로그인해 주세요.')
      setMode('login')
      return
    }
    navigate(from, { replace: true })
  }

  const isLogin = mode === 'login'
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-bold text-slate-900">실험 불확도 계산</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isLogin ? '로그인하면 내 실험이 어디서든 보여요.' : '이메일로 가입하면 실험이 내 계정에 저장돼요.'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">이메일</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-500">비밀번호 {isLogin ? '' : '(6자 이상)'}</span>
          <input
            type="password"
            required
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
        {notice && <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? '잠시만요…' : isLogin ? '로그인' : '회원가입'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(isLogin ? 'signup' : 'login')
          setError('')
          setNotice('')
        }}
        className="mt-4 text-xs text-slate-500 underline"
      >
        {isLogin ? '처음이에요 — 회원가입' : '이미 계정이 있어요 — 로그인'}
      </button>
    </main>
  )
}
