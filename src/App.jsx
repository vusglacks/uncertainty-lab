import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import AppShell from './components/AppShell'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import ExportPage from './pages/ExportPage'

// 주소(경로)마다 보여줄 화면을 연결한다.
// 로그인하지 않아도 모든 화면을 쓸 수 있다. AppShell 이 로그인 여부에 따라 저장소(계정 / 이 브라우저)를 정한다.
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/exp/:id', element: <EditorPage /> },
      { path: '/exp/:id/export', element: <ExportPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> }, // 없는 주소는 시작 화면으로
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
