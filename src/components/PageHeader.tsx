import PeriodSelector from './PeriodSelector'

interface PageHeaderProps {
  title: string
  subtitle: string
  years: string[]
  allMonths: string[]
  loadedAt?: Date | null
}

export default function PageHeader({ title, subtitle, years, allMonths, loadedAt }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-[60px] flex items-center justify-between px-8 bg-nl-white/90 backdrop-blur-md border-b border-nl-border-soft">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[16px] font-display font-bold text-nl-text tracking-tight">{title}</h1>
        <span className="text-[11px] font-mono text-nl-400">{subtitle}</span>
      </div>
      <div className="flex items-center gap-3">
        <PeriodSelector years={years} allMonths={allMonths} />
        {loadedAt && (
          <span className="text-[10px] font-mono text-nl-400">
            Act. {loadedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </header>
  )
}
