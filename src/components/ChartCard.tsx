interface ChartCardProps {
  title: string
  subtitle?: string
  legend?: { color: string; label: string }[]
  height?: number
  children: React.ReactNode
  className?: string
}

export default function ChartCard({ title, subtitle, legend, height = 280, children, className = '' }: ChartCardProps) {
  return (
    <div className={`bg-nl-white rounded-card border border-nl-border-soft shadow-card p-6 ${className}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-[14px] text-nl-text tracking-tight">{title}</h3>
          {subtitle && <p className="text-[10px] font-mono text-nl-400 mt-1">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap gap-3">
            {legend.map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-[10px] font-mono text-nl-500">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  )
}
