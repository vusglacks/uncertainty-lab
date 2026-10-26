import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// 로그인한 사람만 안쪽 화면(시작·편집·내보내기)을 볼 수 있게 감싸는 문지기.
export default function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!supabaseConfigured) return <SetupNeeded />
  if (loading) return <p className="px-6 py-12 text-center text-sm text-slate-400">불러오는 중…</p>
  // 로그인 안 했으면 로그인 화면으로 보낸다. 로그인 뒤 원래 가려던 주소로 돌아오도록 기억해 둔다.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function SetupNeeded() {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-sm text-slate-700">
      <h1 className="text-lg font-bold text-slate-900">Supabase 설정이 필요해요</h1>
      <p className="mt-3">
        프로젝트 폴더의 <code className="rounded bg-slate-100 px-1">.env</code> 파일에 아래 두 값이 없어요.
      </p>
      <ul className="mt-2 list-disc pl-5 font-mono text-xs">
        <li>VITE_SUPABASE_URL</li>
        <li>VITE_SUPABASE_PUBLISHABLE_KEY</li>
      </ul>
      <p className="mt-3">
        <code className="rounded bg-slate-100 px-1">.env.example</code>을 복사해{' '}
        <code className="rounded bg-slate-100 px-1">.env</code>로 만들고 값을 채운 뒤, 개발 서버를 껐다 다시
        켜세요. (배포된 사이트라면 Vercel의 Environment Variables에 넣고 Redeploy)
      </p>
    </main>
  )
}
