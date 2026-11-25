import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Spinner } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import { AdminRubricsPage } from './pages/AdminRubricsPage'
import { AdminTeachersPage } from './pages/AdminTeachersPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ResultsPage } from './pages/ResultsPage'
import { SessionFormPage } from './pages/SessionFormPage'
import { SessionPage } from './pages/SessionPage'

function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { teacher } = useAuth()
  if (admin && !teacher?.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { teacher, loading } = useAuth()
  if (loading) return <Layout><Spinner /></Layout>
  if (!teacher) return <Layout><LoginPage /></Layout>
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sessions/new" element={<SessionFormPage />} />
        <Route path="/sessions/:id" element={<SessionPage />} />
        <Route path="/sessions/:id/edit" element={<SessionFormPage />} />
        <Route path="/sessions/:id/results/:code" element={<ResultsPage />} />
        <Route path="/admin/teachers" element={<Guard admin><AdminTeachersPage /></Guard>} />
        <Route path="/admin/rubrics" element={<Guard admin><AdminRubricsPage /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}
