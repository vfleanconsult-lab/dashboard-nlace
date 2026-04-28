interface Column<T> {
  header: string
  accessor: keyof T | ((row: T) => React.ReactNode)
  align?: 'left' | 'right'
  className?: string
}

interface DataTableProps<T> {
  title: string
  badge?: string
  columns: Column<T>[]
  rows: T[]
  keyFn: (row: T, i: number) => string
  emptyText?: string
}

export default function DataTable<T>({ title, badge, columns, rows, keyFn, emptyText = 'Sin datos en el período' }: DataTableProps<T>) {
  return (
    <div className="bg-nl-white rounded-card border border-nl-border-soft shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-nl-border-soft">
        <span className="font-display font-bold text-[14px] text-nl-text tracking-tight">{title}</span>
        {badge && (
          <span className="text-[10px] font-mono text-nl-400 bg-nl-bg border border-nl-border-ui rounded-pill px-3 py-1">{badge}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-nl-bg">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-5 py-2.5 text-[10px] font-mono text-nl-400 uppercase tracking-[0.1em] border-b border-nl-border-soft font-normal ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-[12px] font-mono text-nl-400">{emptyText}</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={keyFn(row, i)} className="border-b border-nl-border-soft last:border-0 hover:bg-nl-bg/60 transition-colors duration-[150ms]">
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-5 py-3 text-[12.5px] ${col.align === 'right' ? 'text-right font-mono text-nl-700' : 'text-nl-text'} ${col.className ?? ''}`}
                  >
                    {typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
