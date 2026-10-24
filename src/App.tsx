import { useState } from 'react'
import { createHashRouter, Link, NavLink, Outlet, RouterProvider } from 'react-router'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Database,
  GraduationCap,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Upload,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useStore } from './state'
import { controlClass } from './ui/components'
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
    <Dialog open={ready && summaryOpen} onOpenChange={setSummaryOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Data načtena – kontrola</DialogTitle>
          <DialogDescription>Výsledek kontroly načtených exportů.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
          {(Object.keys(FILE_LABELS) as FileKind[]).map((k) => (
            <li key={k} className="truncate">
              {FILE_LABELS[k]}: <span className="font-medium text-foreground">{fileNames[k]}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-3">
            <div className="text-2xl font-semibold tabular-nums">{report.normalizations.length}</div>
            <div className="text-xs text-muted-foreground">automaticky očištěných hodnot</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-2xl font-semibold text-amber-700 tabular-nums">{unresolved.length}</div>
            <div className="text-xs text-muted-foreground">nevyřešených nesrovnalostí</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-2xl font-semibold text-red-700 tabular-nums">{report.rejected.length}</div>
            <div className="text-xs text-muted-foreground">odmítnutých řádků</div>
          </div>
        </div>
        {unresolved.length > 0 && (
          <ul className="max-h-56 divide-y overflow-auto rounded-lg border text-sm">
            {[...byMessage.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([message, count]) => (
                <li key={message} className="flex justify-between gap-4 px-3 py-1.5">
                  <span>{message}</span>
                  <span className="text-muted-foreground tabular-nums">{count}×</span>
                </li>
              ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Řádky s nevyřešenou nesrovnalostí se do výpočtů nezapočítávají (nebo se použijí bez opravené hodnoty), dokud o nich nerozhodnete.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSummaryOpen(false)}>
            Zavřít
          </Button>
          <Button asChild>
            <Link to="/data-quality" onClick={() => setSummaryOpen(false)}>
              Zobrazit kvalitu dat
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Nav({ unresolved, onNavigate }: { unresolved: number; onNavigate?: () => void }) {
  const items = [
    { to: '/', label: 'Agenda', icon: ClipboardList, end: true },
    { to: '/overview', label: 'Přehled', icon: LayoutDashboard },
    { to: '/employees', label: 'Zaměstnanci', icon: Users },
    { to: '/sessions', label: 'Termíny', icon: CalendarDays },
    { to: '/data-quality', label: 'Kvalita dat', icon: Database },
  ]
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {to === '/data-quality' && unresolved > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white tabular-nums">{unresolved}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Settings({ onImport, className }: { onImport: () => void; className?: string }) {
  const { referenceDate, setReferenceDate, windowDays, setWindowDays, reset } = useStore()
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      <label className="flex items-center gap-1.5 text-muted-foreground">
        Referenční datum
        <input
          type="date"
          className={controlClass}
          value={referenceDate}
          onChange={(e) => e.target.value && setReferenceDate(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-1.5 text-muted-foreground">
        Končí do
        <input
          type="number"
          min={0}
          max={3650}
          className={cn(controlClass, 'w-20')}
          value={windowDays}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isInteger(n) && n >= 0 && n <= 3650) setWindowDays(n)
          }}
        />
        dní
      </label>
      <Button onClick={onImport}>
        <Upload />
        Import
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          if (window.confirm('Smazat importovaná data, rozhodnutí i potvrzené přihlášky a vrátit ukázková data?')) reset()
        }}
      >
        <RotateCcw />
        Obnovit ukázková data
      </Button>
    </div>
  )
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-4" />
      </span>
      Evidence školení
    </Link>
  )
}

function Layout() {
  const { report, resolutions, ready, loadError } = useStore()
  const [importOpen, setImportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id]).length
  const openImport = () => {
    setMenuOpen(false)
    setImportOpen(true)
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <Nav unresolved={unresolved} />
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:hidden">
            <Brand />
            <Button variant="outline" size="icon" aria-label="Menu" onClick={() => setMenuOpen(true)}>
              <Menu />
            </Button>
          </div>
          <Settings onImport={openImport} className="hidden justify-end px-6 py-2.5 lg:flex" />
        </header>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 gap-6 p-4">
            <SheetHeader className="p-0">
              <SheetTitle>
                <Brand />
              </SheetTitle>
            </SheetHeader>
            <Nav unresolved={unresolved} onNavigate={() => setMenuOpen(false)} />
            <Settings onImport={openImport} className="flex-col items-stretch [&_label]:flex-wrap" />
          </SheetContent>
        </Sheet>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
          {unresolved > 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle />
              <AlertTitle>{unresolved} nevyřešených nesrovnalostí v datech</AlertTitle>
              <AlertDescription className="text-amber-800">
                <span>
                  Výsledky mohou být neúplné.{' '}
                  <Link to="/data-quality" className="font-medium underline underline-offset-2">
                    Vyřešit
                  </Link>
                </span>
              </AlertDescription>
            </Alert>
          )}
          {ready ? <Outlet /> : <p role={loadError ? 'alert' : undefined}>{loadError ?? 'Načítám data…'}</p>}
        </main>
      </div>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Import exportů</DialogTitle>
            <DialogDescription>Nahrajte nové exporty z personálního systému.</DialogDescription>
          </DialogHeader>
          <ImportForm onDone={() => setImportOpen(false)} />
        </DialogContent>
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
