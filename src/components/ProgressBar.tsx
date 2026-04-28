interface Props { pct: number; color?: string }

export default function ProgressBar({ pct, color = '#5869f7' }: Props) {
  return (
    <div className="w-full h-1 bg-nl-border-soft rounded-full mt-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  )
}
