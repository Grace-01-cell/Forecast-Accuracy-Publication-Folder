import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Label,
  ReferenceLine,
  Customized,
} from "recharts";

type HistogramBin = {
  x: number;      // midpoint
  count: number;  // frequency
  start: number;  // tooltip range start
  end: number;    // tooltip range end
  density: number; // scaled curve value (same axis as count)
};

interface HistogramChartProps {
  actuals: number[];
  productName: string;
  bins?: number; // optional override
}

const formatNumber = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

function mean(values: number[]) {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function std(values: number[]) {
  if (values.length < 2) return NaN;
  const m = mean(values);
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function gaussian(u: number) {
  return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
}

// Simple KDE at a point x, using bandwidth h
function kdeAtPoint(x: number, values: number[], h: number) {
  if (!values.length || !Number.isFinite(h) || h <= 0) return 0;
  const n = values.length;
  let sum = 0;
  for (const v of values) sum += gaussian((x - v) / h);
  return sum / (n * h);
}

function createHistogramData(actuals: number[], numBins: number): {
  data: HistogramBin[];
  minVal: number;
  maxVal: number;
  binSize: number;
} {
  const clean = actuals.filter((v) => Number.isFinite(v));
  if (!clean.length) return { data: [], minVal: 0, maxVal: 0, binSize: 1 };

  const minVal = Math.min(...clean);
  const maxVal = Math.max(...clean);
  const span = maxVal - minVal;

  if (span < 1e-9) {
    return {
      data: [{ x: minVal, count: clean.length, start: minVal, end: minVal, density: clean.length }],
      minVal,
      maxVal,
      binSize: 1,
    };
  }

  const binSize = span / numBins;

  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => {
    const start = minVal + i * binSize;
    const end = i === numBins - 1 ? maxVal : minVal + (i + 1) * binSize;
    const x = (start + end) / 2;
    return { x, count: 0, start, end, density: 0 };
  });

  for (const v of clean) {
    let idx = Math.floor((v - minVal) / binSize);
    if (idx < 0) idx = 0;
    if (idx >= numBins) idx = numBins - 1;
    bins[idx].count += 1;
  }

  // KDE bandwidth (Silverman's rule of thumb-ish)
  const s = std(clean);
  const n = clean.length;
  const h = Number.isFinite(s) && s > 0 ? 1.06 * s * Math.pow(n, -1 / 5) : binSize;

  // Compute unscaled density at bin midpoints
  const rawDens = bins.map((b) => kdeAtPoint(b.x, clean, h));
  const maxRaw = Math.max(...rawDens, 0);
  const maxCount = Math.max(...bins.map((b) => b.count), 0);

  // Scale density so curve fits on same axis as counts
  const scale = maxRaw > 0 ? (maxCount / maxRaw) : 1;

  bins.forEach((b, i) => {
    b.density = rawDens[i] * scale;
  });

  return { data: bins, minVal, maxVal, binSize };
}

/** Always-visible Mean/Median badges using Customized */
function MeanMedianBadges({
  meanVal,
  medianVal,
  format,
}: {
  meanVal: number;
  medianVal: number;
  format: (n: number) => string;
}) {
  return (
    <Customized
      component={(props: any) => {
        const xAxis = props?.xAxisMap ? Object.values(props.xAxisMap)[0] : null;
        const yAxis = props?.yAxisMap ? Object.values(props.yAxisMap)[0] : null;
        const xScale = xAxis?.scale;
        const yScale = yAxis?.scale;

        if (!xScale || !yScale) return null;

        const xMean = Number.isFinite(meanVal) ? xScale(meanVal) : null;
        const xMed = Number.isFinite(medianVal) ? xScale(medianVal) : null;

        // place labels inside plot near the top
        const yTop1 = yScale(yAxis.domain?.[1] ?? 0) + 18; // safe-ish
        const yTop2 = yTop1 + 22;

        const Badge = (x: number, y: number, text: string, color: string) => (
          <g>
            <rect x={x - 64} y={y - 14} width={128} height={20} rx={10} fill="#fff" stroke="#e5e7eb" />
            <text x={x} y={y} textAnchor="middle" fontSize={12} fontWeight={700} fill={color}>
              {text}
            </text>
          </g>
        );

        return (
          <g>
            {xMean != null && Badge(xMean, yTop1, `Mean: ${format(meanVal)}`, "#ef4444")}
            {xMed != null && Badge(xMed, yTop2, `Median: ${format(medianVal)}`, "#111827")}
          </g>
        );
      }}
    />
  );
}

const HistogramChart: React.FC<HistogramChartProps> = ({ actuals, productName, bins = 12 }) => {
  const clean = useMemo(() => actuals.filter((v) => Number.isFinite(v)), [actuals]);
  const m = useMemo(() => mean(clean), [clean]);
  const med = useMemo(() => median(clean), [clean]);

  const { data, minVal, maxVal, binSize } = useMemo(
    () => createHistogramData(clean, bins),
    [clean, bins]
  );

  const maxCount = useMemo(() => (data.length ? Math.max(...data.map((d) => d.count)) : 0), [data]);

  // ✅ padding so bars don't overlap the Y-axis
  const domainMin = data.length ? minVal - binSize / 2 : 0;
  const domainMax = data.length ? maxVal + binSize / 2 : 1;

  if (!data.length) return null;

  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 36, right: 18, left: 18, bottom: 42 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="x"
            type="number"
            domain={[domainMin, domainMax]}
            tickFormatter={(v) => formatNumber(v as number)}
            stroke="#6b7280"
          >
            <Label
              value={`Actual Monthly Consumption Distribution (${productName})`}
              position="bottom"
              offset={18}
              style={{ fill: "#6b7280" }}
            />
          </XAxis>

          {/* add headroom so badges never clip */}
          <YAxis
            stroke="#6b7280"
            allowDecimals={false}
            domain={[0, maxCount + 3]}
          >
            <Label
              value="Frequency (Months)"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle", fill: "#6b7280" }}
            />
          </YAxis>

          <Tooltip
            formatter={(value: any, name: any) => [
              (value as number).toLocaleString(undefined, { maximumFractionDigits: 2 }),
              name === "density" ? "Curve (shape)" : "Months",
            ]}
            labelFormatter={(_: any, payload: any) => {
              const p = payload?.[0]?.payload as HistogramBin | undefined;
              if (!p) return "";
              return `Range: ${formatNumber(p.start)} – ${formatNumber(p.end)}`;
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #d1d5db",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />

          {/* vertical reference lines */}
          {Number.isFinite(m) && (
            <ReferenceLine x={m} stroke="#ef4444" strokeDasharray="6 4" />
          )}
          {Number.isFinite(med) && (
            <ReferenceLine x={med} stroke="#111827" strokeDasharray="2 6" />
          )}

          {/* Always-visible badges for mean/median */}
          <MeanMedianBadges meanVal={m} medianVal={med} format={formatNumber} />

          {/* bars */}
          <Bar dataKey="count" fill="#3b82f6" barSize={28} />

          {/* curve (density scaled to same axis) */}
          <Line
            type="monotone"
            dataKey="density"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
