import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { COLORS, TOOLTIP_STYLE } from './theme'
import { formatCLP } from '../../lib/data'

interface DataPoint { label: string; bar: number; line: number }

interface MergedPoint {
  label: string
  barA: number; lineA: number
  barB?: number; lineB?: number
}

interface Props {
  data: DataPoint[]
  compareData?: DataPoint[]
  labelA?: string
  labelB?: string
  barColor?: string
  lineColor?: string
  barLabel?: string
  lineLabel?: string
}

function merge(a: DataPoint[], b: DataPoint[]): MergedPoint[] {
  // Align by month label (Ene, Feb...) — works for YoY and range comparison
  const allLabels = [...new Set([...a.map(d => d.label), ...b.map(d => d.label)])]
  const mapA = Object.fromEntries(a.map(d => [d.label, d]))
  const mapB = Object.fromEntries(b.map(d => [d.label, d]))
  return allLabels.map(label => ({
    label,
    barA:  mapA[label]?.bar  ?? 0,
    lineA: mapA[label]?.line ?? 0,
    barB:  mapB[label]?.bar  ?? 0,
    lineB: mapB[label]?.line ?? 0,
  }))
}

export default function AreaBarChart({
  data, compareData,
  labelA = 'Período A', labelB = 'Período B',
  barColor, lineColor,
  barLabel = 'Ventas', lineLabel = 'Margen Op. %',
}: Props) {
  const bc  = barColor  ?? COLORS.primary
  const lc  = lineColor ?? COLORS.accent
  const bc2 = COLORS.purple
  const lc2 = COLORS.amber

  const isCompare = !!compareData && compareData.length > 0
  const chartData: MergedPoint[] = isCompare
    ? merge(data, compareData!)
    : data.map(d => ({ label: d.label, barA: d.bar, lineA: d.line }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap={isCompare ? '20%' : '30%'} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fill: COLORS.text, fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={v => formatCLP(v, true)}
          width={60}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: COLORS.text, fontSize: 11 }}
          axisLine={false} tickLine={false}
          tickFormatter={v => `${Number(v).toFixed(0)}%`}
          width={44}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number, name: string) => {
            if (name.startsWith('Margen') || name.includes('%')) return [`${value.toFixed(1)}%`, name]
            return [formatCLP(value), name]
          }}
        />
        {isCompare && (
          <Legend
            iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 11, color: COLORS.text, paddingTop: 12 }}
          />
        )}
        <ReferenceLine yAxisId="right" y={0} stroke={COLORS.grid} />

        {/* Primary bars */}
        <Bar
          yAxisId="left" dataKey="barA"
          name={isCompare ? `${barLabel} (${labelA})` : barLabel}
          fill={bc} radius={[4, 4, 0, 0]} maxBarSize={isCompare ? 24 : 40}
        />

        {/* Compare bars */}
        {isCompare && (
          <Bar
            yAxisId="left" dataKey="barB"
            name={`${barLabel} (${labelB})`}
            fill={bc2} radius={[4, 4, 0, 0]} maxBarSize={24}
          />
        )}

        {/* Primary margin line */}
        <Line
          yAxisId="right" type="monotone" dataKey="lineA"
          name={isCompare ? `${lineLabel} (${labelA})` : lineLabel}
          stroke={lc} strokeWidth={2}
          dot={{ fill: lc, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }}
        />

        {/* Compare margin line */}
        {isCompare && (
          <Line
            yAxisId="right" type="monotone" dataKey="lineB"
            name={`${lineLabel} (${labelB})`}
            stroke={lc2} strokeWidth={2} strokeDasharray="4 4"
            dot={{ fill: lc2, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
