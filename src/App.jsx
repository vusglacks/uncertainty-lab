import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import ExportPage from './pages/ExportPage'

// 주소(경로)마다 보여줄 화면을 연결한다.
// /login 만 누구나 볼 수 있고, 나머지는 RequireAuth(로그인 확인)로 감싼다.
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
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
