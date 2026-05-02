import { NavLink } from 'react-router-dom'
import { NlaceLogo } from '@nlace/ui-kit'
import { LayoutDashboard, TrendingUp, Package, Receipt, Clock, BarChart2 } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/',                  label: 'Resumen Ejecutivo', Icon: LayoutDashboard },
  { to: '/ingresos',          label: 'Ingresos',          Icon: TrendingUp      },
  { to: '/costos',            label: 'Costos',            Icon: Package         },
  { to: '/gastos',            label: 'Gastos',            Icon: Receipt         },
  { to: '/cobranzas',         label: 'Cobranzas',         Icon: Clock           },
  { to: '/estado-resultado',  label: 'Estado Resultado',  Icon: BarChart2       },
]

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 bottom-0 w-56 bg-nl-white border-r border-nl-border-soft flex flex-col z-50">
      <div className="px-5 py-5 border-b border-nl-border-soft">
        <NlaceLogo variant="dark" height={28} />
        <p className="mt-1.5 text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em]">
          Financial Intelligence
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 mb-2 text-[9px] font-mono text-nl-400 uppercase tracking-[0.12em]">
          Vistas
        </p>
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-body transition-all duration-[220ms] cursor-pointer',
                isActive
                  ? 'bg-nl-primary-10 text-nl-primary font-medium'
                  : 'text-nl-700 hover:bg-nl-bg hover:text-nl-text',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} className="shrink-0" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-nl-border-soft">
        <p className="text-[10px] font-mono text-nl-400">NLACE Dashboard v2</p>
      </div>
    </aside>
  )
}
