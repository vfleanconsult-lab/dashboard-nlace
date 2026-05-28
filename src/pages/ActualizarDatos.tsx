import { useNavigate } from 'react-router-dom'
import { Package, Receipt, TrendingUp, ShoppingCart, ChevronRight, Clock, RefreshCw } from 'lucide-react'

const MODULES = [
  {
    to: '/actualizar-costos',
    label: 'Costos',
    description: 'Cartola bancaria → tabla costos y remuneraciones',
    Icon: Package,
    color: 'nl-primary',
    active: true,
  },
  {
    to: '/actualizar-gastos',
    label: 'Gastos',
    description: 'Cartola bancaria → tabla gastos operacionales',
    Icon: Receipt,
    color: 'nl-accent',
    active: true,
  },
  {
    to: '/actualizar-ventas',
    label: 'Ingresos',
    description: 'Reporte Nubox (.csv) → tabla ventas',
    Icon: TrendingUp,
    color: 'nl-success',
    active: true,
  },
  {
    to: '/actualizar-estado-facturas',
    label: 'Estado Facturas',
    description: 'Cartola bancaria → cambia estado Emitida → Pagada en tabla ventas',
    Icon: RefreshCw,
    color: 'violet',
    active: true,
  },
  {
    to: null,
    label: 'Nuevas Ventas',
    description: 'Próximamente: registro de nuevas ventas y pipeline',
    Icon: ShoppingCart,
    color: 'nl-400',
    active: false,
  },
]

export default function ActualizarDatos() {
  const navigate = useNavigate()

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold text-nl-text">Actualizar Datos</h1>
        <p className="mt-1 text-sm font-body text-nl-500">
          Selecciona el módulo para cargar información desde la cartola bancaria a Supabase.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        {MODULES.map(({ to, label, description, Icon, color, active }) => {
          const colorMap: Record<string, string> = {
            'nl-primary': 'bg-nl-primary-10 text-nl-primary border-nl-primary/20 hover:border-nl-primary/50 hover:bg-nl-primary-10',
            'nl-accent': 'bg-orange-50 text-nl-accent border-orange-200 hover:border-nl-accent/50 hover:bg-orange-50',
            'nl-success': 'bg-green-50 text-nl-success-dark border-green-200 hover:border-green-400/50 hover:bg-green-50',
            'violet': 'bg-violet-50 text-violet-600 border-violet-200 hover:border-violet-400/50 hover:bg-violet-50',
            'nl-400': 'bg-nl-bg text-nl-400 border-nl-border-soft',
          }
          const iconColorMap: Record<string, string> = {
            'nl-primary': 'text-nl-primary',
            'nl-accent': 'text-nl-accent',
            'nl-success': 'text-nl-success-dark',
            'violet': 'text-violet-600',
            'nl-400': 'text-nl-400',
          }
          const cardClass = [
            'relative rounded-2xl border p-6 transition-all duration-200',
            active ? 'cursor-pointer ' + colorMap[color] : 'cursor-not-allowed opacity-60 ' + colorMap[color],
          ].join(' ')

          return (
            <div
              key={label}
              className={cardClass}
              onClick={() => active && to && navigate(to)}
              role={active ? 'button' : undefined}
              tabIndex={active ? 0 : undefined}
              onKeyDown={(e) => { if (active && to && e.key === 'Enter') navigate(to) }}
            >
              {!active && (
                <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-mono text-nl-400 uppercase tracking-wider">
                  <Clock size={11} />
                  Próximamente
                </span>
              )}

              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl ${active ? 'bg-white/70' : 'bg-white/50'} shrink-0`}>
                  <Icon size={22} strokeWidth={1.75} className={iconColorMap[color]} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`font-display font-semibold text-base ${active ? (iconColorMap[color] ?? 'text-nl-accent') : 'text-nl-400'}`}>
                    {label}
                  </p>
                  <p className="mt-1 text-[12px] font-body text-nl-500 leading-snug">{description}</p>
                </div>

                {active && (
                  <ChevronRight size={18} strokeWidth={1.75} className={`shrink-0 mt-0.5 ${iconColorMap[color] ?? 'text-nl-accent'}`} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
