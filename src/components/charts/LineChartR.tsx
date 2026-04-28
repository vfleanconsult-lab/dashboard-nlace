import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { COLORS, TOOLTIP_STYLE } from './theme'

interface DataPoint { label: string; value: number | null }

interface Props {
  data: DataPoint[]
  color?: string
  yTickFormatter?: (v: number) => string
  referenceLines?: { y: number; label: string; color: string }[]
}

export default function LineChartR({ data, color = COLORS.primary, yTickFormatter, referenceLines = [] }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: COLORS.text, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yTickFormatter ?? (v => `${v}`)}
          width={44}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v: number) => [yTickFormatter ? yTickFormatter(v) : v, 'DSO']}
        />
        {referenceLines.map((rl, i) => (
          <ReferenceLine key={i} y={rl.y} stroke={rl.color} strokeDasharray="4 4" label={{ value: rl.label, fill: rl.color, fontSize: 10 }} />
        ))}
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ fill: color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
