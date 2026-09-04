'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { RegionDice } from '@/lib/api'

interface DiceBarChartProps {
  baseline: RegionDice
  dualDomain: RegionDice
}

const REGION_LABELS = ['WT', 'TC', 'ET']
const REGION_KEYS: Array<keyof RegionDice> = ['wt', 'tc', 'et']

export default function DiceBarChart({ baseline, dualDomain }: DiceBarChartProps) {
  const data = REGION_LABELS.map((label, i) => ({
    region: label,
    Baseline: parseFloat(baseline[REGION_KEYS[i]].toFixed(4)),
    'Dual-Domain': parseFloat(dualDomain[REGION_KEYS[i]].toFixed(4)),
  }))

  return (
    <div>
      <h3
        style={{
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: 'var(--color-primary-dark)',
          marginBottom: '0.75rem',
        }}
      >
        DSC Comparison — Bar Chart
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="30%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(9,93,126,0.1)" />
          <XAxis
            dataKey="region"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
            }}
            formatter={(value) => [typeof value === 'number' ? value.toFixed(4) : value, undefined]}
          />
          <Legend
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ fontSize: '0.8125rem', paddingTop: 8 }}
          />
          <Bar dataKey="Baseline" fill="#5a7d85" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Dual-Domain" fill="#14967f" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
