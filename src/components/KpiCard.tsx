import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'primary' | 'success' | 'danger' | 'accent' | 'amber' | 'neutral'
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  compare?: { value: string; delta: number | null }
  className?: string
}

const accentMap = {
  primary: { dot: 'bg-nl-primary',      value: 'text-nl-primary',      strip: 'bg-nl-primary',      icon: 'text-nl-primary bg-nl-primary-10' },
  success: { dot: 'bg-nl-success-dark', value: 'text-nl-success-dark', strip: 'bg-nl-success-dark', icon: 'text-nl-success-dark bg-nl-success-bg' },
  danger:  { dot: 'bg-nl-danger',       value: 'text-nl-danger',       strip: 'bg-nl-danger',       icon: 'text-nl-danger bg-nl-danger-8' },
  accent:  { dot: 'bg-nl-accent',       value: 'text-nl-accent',       strip: 'bg-nl-accent',       icon: 'text-nl-accent bg-nl-accent-10' },
  amber:   { dot: 'bg-[#f59e0b]',       value: 'text-[#f59e0b]',       strip: 'bg-[#f59e0b]',       icon: 'text-[#f59e0b] bg-amber-50' },
  neutral: { dot: 'bg-nl-400',          value: 'text-nl-700',          strip: 'bg-nl-400',          icon: 'text-nl-500 bg-nl-bg' },
}

function DeltaBadge({ delta }: { delta: number }) {
  const positive = delta >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-body font-semibold tabular-nums px-1.5 py-0.5 rounded-[6px] ${positive ? 'text-nl-success-text bg-nl-success-bg' : 'text-nl-danger bg-nl-danger-8'}`}>
      {positive ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

export default function KpiCard({ label, value, sub, accent = 'neutral', trend, icon: Icon, compare, className = '' }: KpiCardProps) {
  const a = accentMap[accent]
  return (
    <div className={`relative bg-nl-white rounded-card border border-nl-border-soft shadow-card hover:shadow-hover transition-all duration-[220ms] overflow-hidden cursor-default ${className}`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 ${a.strip}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.dot}`} />
            <span className="text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] leading-none">{label}</span>
          </div>
          {Icon && (
            <span className={`flex items-center justify-center w-7 h-7 rounded-[8px] ${a.icon}`}>
              <Icon size={14} strokeWidth={2} />
            </span>
          )}
        </div>

        {compare ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-[9px] font-mono text-nl-400 uppercase tracking-[0.08em] mb-1">Período A</div>
                <div className={`font-body text-[20px] font-bold tabular-nums leading-none ${a.value}`}>{value}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono text-nl-400 uppercase tracking-[0.08em] mb-1">Período B</div>
                <div className="font-body text-[20px] font-bold tabular-nums leading-none text-nl-400">{compare.value}</div>
              </div>
            </div>
            {compare.delta !== null && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-nl-border-soft">
                <span className="text-[10px] font-mono text-nl-400">Variación:</span>
                <DeltaBadge delta={compare.delta} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={`font-body text-[24px] font-bold tabular-nums leading-none mb-2 ${a.value}`}>
              {value}
            </div>
            {(sub || trend) && (
              <div className="flex items-center gap-1.5">
                {trend && (
                  <span className={`text-[11px] font-mono font-medium ${trend === 'up' ? 'text-nl-success-dark' : trend === 'down' ? 'text-nl-danger' : 'text-nl-400'}`}>
                    {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                  </span>
                )}
                {sub && <div className="text-[11px] font-mono text-nl-400 truncate">{sub}</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
