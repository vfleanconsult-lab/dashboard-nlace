import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PALETTE, COLORS, TOOLTIP_STYLE } from './theme'
import { formatCLP } from '../../lib/data'

interface Series { key: string; label: string; color?: string }

interface Props {
  data: Record<string, unknown>[]
  series: Series[]
  stacked?: boolean
}

export default function NlaceAreaChart({ data, series, stacked = false }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? PALETTE[i]
            return (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCLP(Number(v), true)} width={60} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [formatCLP(v), name]} />
        {series.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: COLORS.text, paddingTop: 12 }} />
        )}
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i]
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              stackId={stacked ? 'stack' : undefined}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}
