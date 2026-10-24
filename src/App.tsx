import { useState } from 'react'
import { createHashRouter, NavLink, Outlet, RouterProvider, Link } from 'react-router'
import { useStore } from './state'
import { buttonClass, Dialog, inputClass, primaryButtonClass } from './ui/components'
import { ImportForm } from './ui/forms'
import { Overview } from './pages/Overview'
import { Agenda } from './pages/Agenda'
import { Employees } from './pages/Employees'
import { EmployeeDetail } from './pages/EmployeeDetail'
import { Sessions } from './pages/Sessions'
import { DataQuality } from './pages/DataQuality'
import { FILE_LABELS, type FileKind } from './domain/types'

function ImportSummary() {
  const { report, resolutions, summaryOpen, setSummaryOpen, fileNames, ready } = useStore()
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id])
  const byMessage = new Map<string, number>()
  for (const i of unresolved) byMessage.set(i.message, (byMessage.get(i.message) ?? 0) + i.rows.length)
  return (
    <Dialog open={ready && summaryOpen} onClose={() => setSummaryOpen(false)} title="Data načtena – kontrola">
      <ul className="mb-3 text-sm text-slate-600">
        {(Object.keys(FILE_LABELS) as FileKind[]).map((k) => (
          <li key={k}>
            {FILE_LABELS[k]}: <span className="text-slate-900">{fileNames[k]}</span>
          </li>
        ))}
      </ul>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded border border-slate-200 p-3">
          <div className="text-2xl font-semibold">{report.normalizations.length}</div>
          <div className="text-xs text-slate-500">automaticky očištěných hodnot</div>
        </div>
        <div className="rounded border border-amber-300 bg-amber-50 p-3">
          <div className="text-2xl font-semibold text-amber-800">{unresolved.length}</div>
          <div className="text-xs text-slate-500">nevyřešených nesrovnalostí</div>
        </div>
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <div className="text-2xl font-semibold text-red-800">{report.rejected.length}</div>
          <div className="text-xs text-slate-500">odmítnutých řádků</div>
        </div>
      </div>
      {unresolved.length > 0 && (
        <ul className="mb-4 max-h-60 space-y-1 overflow-auto text-sm">
          {[...byMessage.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([message, count]) => (
              <li key={message} className="flex justify-between gap-4">
                <span>{message}</span>
                <span className="text-slate-500">{count}×</span>
              </li>
            ))}
        </ul>
      )}
      <p className="mb-4 text-sm text-slate-600">
        Řádky s nevyřešenou nesrovnalostí se do výpočtů nezapočítávají (nebo se použijí bez opravené hodnoty), dokud o nich nerozhodnete.
      </p>
      <div className="flex gap-2">
        <Link to="/data-quality" className={primaryButtonClass} onClick={() => setSummaryOpen(false)}>
          Zobrazit kvalitu dat
        </Link>
        <button type="button" className={buttonClass} onClick={() => setSummaryOpen(false)}>
          Zavřít
        </button>
      </div>
    </Dialog>
  )
}

function Layout() {
  const { report, resolutions, referenceDate, setReferenceDate, windowDays, setWindowDays, reset, ready, loadError } = useStore()
  const [importOpen, setImportOpen] = useState(false)
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id]).length
  const nav = ({ isActive }: { isActive: boolean }) =>
    `rounded px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-sky-100 text-sky-900' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <h1 className="text-lg font-semibold">Evidence školení</h1>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={nav}>
              Agenda
            </NavLink>
            <NavLink to="/overview" className={nav}>
              Přehled
            </NavLink>
            <NavLink to="/employees" className={nav}>
              Zaměstnanci
            </NavLink>
            <NavLink to="/sessions" className={nav}>
              Termíny
            </NavLink>
            <NavLink to="/data-quality" className={nav}>
              Kvalita dat{unresolved > 0 && <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs text-white">{unresolved}</span>}
            </NavLink>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              Referenční datum
              <input
                type="date"
                className={inputClass}
                value={referenceDate}
                onChange={(e) => e.target.value && setReferenceDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1">
              Končí do
              <input
                type="number"
                min={0}
                max={3650}
                className={`${inputClass} w-20`}
                value={windowDays}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isInteger(n) && n >= 0 && n <= 3650) setWindowDays(n)
                }}
              />
              dní
            </label>
            <button type="button" className={primaryButtonClass} onClick={() => setImportOpen(true)}>
              Import
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                if (window.confirm('Smazat importovaná data, rozhodnutí i potvrzené přihlášky a vrátit ukázková data?')) reset()
              }}
            >
              Obnovit ukázková data
            </button>
          </div>
        </div>
      </header>
      {unresolved > 0 && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-7xl px-4 py-2 text-sm text-amber-900">
            {unresolved} nevyřešených nesrovnalostí v datech – výsledky mohou být neúplné.{' '}
            <Link to="/data-quality" className="font-medium underline">
              Vyřešit
            </Link>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {ready ? <Outlet /> : <p role={loadError ? 'alert' : undefined}>{loadError ?? 'Načítám data…'}</p>}
      </main>
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Import exportů">
        <ImportForm onDone={() => setImportOpen(false)} />
      </Dialog>
      <ImportSummary />
    </div>
  )
}

const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Agenda /> },
      { path: '/overview', element: <Overview /> },
      { path: '/employees', element: <Employees /> },
      { path: '/employees/:id', element: <EmployeeDetail /> },
      { path: '/sessions', element: <Sessions /> },
      { path: '/data-quality', element: <DataQuality /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
