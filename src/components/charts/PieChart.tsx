import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PALETTE, TOOLTIP_STYLE } from './theme'
import { formatCLP } from '../../lib/data'

interface Props {
  data: { name: string; value: number }[]
  innerRadius?: number | string
}

export default function NlacePieChart({ data, innerRadius = '62%' }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="40%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={0.88} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number, name: string) => {
            const pct = total > 0 ? (value / total * 100).toFixed(1) : '0'
            return [`${formatCLP(value, true)} (${pct}%)`, name]
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#71717a', fontFamily: 'Inter, sans-serif' }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
