import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { formatRut } from '../lib/rut'

export function Layout({ children }: { children: ReactNode }) {
  const { teacher, logout } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-red-700">Proyecto de Título · TIHI84</span>
            <span className="text-xs text-slate-500">Evaluación de Defensa y Demostración</span>
          </Link>
          {teacher && (
            <nav className="flex flex-wrap items-center gap-3 text-sm">
              <Link to="/" className="hover:text-red-700">Proyectos</Link>
              {teacher.is_admin && (
                <>
                  <Link to="/admin/teachers" className="hover:text-red-700">Docentes</Link>
                  <Link to="/admin/rubrics" className="hover:text-red-700">Puntajes</Link>
                </>
              )}
              <span className="text-slate-400">|</span>
              <span className="text-slate-600">{teacher.full_name} <span className="text-slate-400">({formatRut(teacher.rut)})</span></span>
              <button onClick={() => void logout()} className="btn-secondary">Salir</button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="my-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return <p className="py-10 text-center text-slate-500">{label}</p>
}
