import { useState, type ComponentProps, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useStore } from '../state'
import { plural } from '../domain/plural'
import { controlClass } from './components'
import { ImportForm } from './forms'
import { ImportSummary } from './import-summary'
import { UNRESOLVED } from './labels'

function Nav(props: ComponentProps<'nav'>) {
  return <nav className="flex flex-col gap-0.5" {...props} />
}

function NavItem({ to, icon: Icon, end, children }: { to: string; icon: LucideIcon; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="size-4" />
      {children}
    </NavLink>
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

export function Layout() {
  const { report, resolutions, ready, loadError } = useStore()
  const [importOpen, setImportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const unresolved = report.inconsistencies.filter((i) => !resolutions[i.id]).length
  const openImport = () => {
    setMenuOpen(false)
    setImportOpen(true)
  }
  const navItems = (
    <>
      <NavItem to="/" icon={ClipboardList} end>
        Agenda
      </NavItem>
      <NavItem to="/overview" icon={LayoutDashboard}>
        Přehled
      </NavItem>
      <NavItem to="/employees" icon={Users}>
        Zaměstnanci
      </NavItem>
      <NavItem to="/sessions" icon={CalendarDays}>
        Termíny
      </NavItem>
      <NavItem to="/data-quality" icon={Database}>
        Kvalita dat
        {unresolved > 0 && (
          <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white tabular-nums">{unresolved}</span>
        )}
      </NavItem>
    </>
  )

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <Nav>{navItems}</Nav>
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
          <SheetContent side="left" className="w-72 gap-6 p-4" onOpenAutoFocus={(e) => e.preventDefault()}>
            <SheetHeader className="p-0">
              <SheetTitle>
                <Brand />
              </SheetTitle>
            </SheetHeader>
            <Nav onClick={() => setMenuOpen(false)}>{navItems}</Nav>
            <Settings onImport={openImport} className="flex-col items-stretch [&_label]:flex-wrap" />
          </SheetContent>
        </Sheet>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
          {unresolved > 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle />
              <AlertTitle>{plural(unresolved, UNRESOLVED)} v datech</AlertTitle>
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
