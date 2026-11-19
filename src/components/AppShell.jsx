import { Link, Outlet } from 'react-router-dom'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { StorageProvider } from '../lib/storageContext'

// 모든 안쪽 화면(시작·편집·내보내기)을 감싸는 틀.
// 로그인했으면 실험을 계정(Supabase)에 저장하고, 로그인하지 않았어도 쓸 수 있게 이 브라우저에 저장한다.
// 로그인 상태가 바뀌면 화면을 새로 만들어서(key) 저장소가 바뀐 것을 반영한다.
export default function AppShell() {
  const { user, loading } = useAuth()

  if (loading) return <p className="px-6 py-12 text-center text-sm text-slate-400">불러오는 중…</p>

  const mode = user ? 'cloud' : 'guest'
  return (
    <StorageProvider mode={mode}>
      {mode === 'guest' && <GuestBanner />}
      <Outlet key={user?.id ?? 'guest'} />
    </StorageProvider>
  )
}

// 로그인하지 않고 쓰는 중이라는 안내. 로그인하면 계정에 저장할 수 있다고 알려준다.
function GuestBanner() {
  return (
    <div className="bg-sky-50 px-6 py-2 text-center text-xs text-sky-900">
      로그인 없이 쓰는 중이에요. 실험은 이 브라우저에만 저장돼서 다른 기기에서는 안 보이고, 브라우저 데이터를 지우면 사라져요.
      {supabaseConfigured && (
        <>
          {' '}
          <Link to="/login" state={{ from: '/' }} className="font-medium underline">
            로그인하고 계정에 저장
          </Link>
        </>
      )}
    </div>
  )
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
