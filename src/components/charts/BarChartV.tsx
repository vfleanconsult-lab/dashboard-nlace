import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { PALETTE, COLORS, TOOLTIP_STYLE } from './theme'
import { formatCLP } from '../../lib/data'

interface Dataset { key: string; label: string; color?: string }

interface Props {
  data: Record<string, unknown>[]
  datasets: Dataset[]
  stacked?: boolean
  multiColor?: boolean
}

export default function BarChartV({ data, datasets, stacked = false, multiColor = false }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCLP(Number(v), true)} width={60} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [formatCLP(v), name]} />
        {datasets.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: COLORS.text, paddingTop: 12 }} />
        )}
        {datasets.map((ds, i) => {
          const color = ds.color ?? PALETTE[i]
          return (
            <Bar key={ds.key} dataKey={ds.key} name={ds.label} fill={color} radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]} stackId={stacked ? 'stack' : undefined} maxBarSize={48}>
              {multiColor && data.map((_, idx) => (
                <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
              ))}
            </Bar>
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}
