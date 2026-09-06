import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import ExportPage from './pages/ExportPage'

// 주소(경로)마다 보여줄 화면을 연결한다.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/exp/:id', element: <EditorPage /> },
  { path: '/exp/:id/export', element: <ExportPage /> },
  { path: '*', element: <Navigate to="/" replace /> }, // 없는 주소는 시작 화면으로
])

export default function App() {
  return <RouterProvider router={router} />
}
