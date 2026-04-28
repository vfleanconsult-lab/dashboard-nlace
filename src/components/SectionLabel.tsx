interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export default function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-3 mb-3 ${className}`}>
      <span className="text-[10px] font-mono text-nl-400 uppercase tracking-[0.12em] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-nl-border-soft" />
    </div>
  )
}
