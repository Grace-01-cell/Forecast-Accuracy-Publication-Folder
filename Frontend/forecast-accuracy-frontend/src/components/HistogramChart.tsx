// src/components/HistogramChart.tsx
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
  x: number;
  count: number;
  start: number;
  end: number;
};

interface HistogramChartProps {
  actuals: number[];
  productName: string;
  bins?: number;
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

function normalPdf(x: number, mu: number, sigma: number) {
  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function createHistogramData(
  actuals: number[],
  numBins: number
): {
  data: HistogramBin[];
  minVal: number;
  maxVal: number;
  binSize: number;
} {
  const clean = actuals.filter((v) => Number.isFinite(v));
  if (!clean.length) return { data: [], minVal: 0, maxVal: 0, binSize: 1 };

  const maxVal = Math.max(...clean);
  const minVal = Math.min(...clean);
  const span = maxVal - minVal;

  if (span < 1e-9) {
    return {
      data: [{ x: minVal, count: clean.length, start: minVal, end: minVal }],
      minVal,
      maxVal,
      binSize: 1,
    };
  }

  const binSize = span / numBins;

  const data: HistogramBin[] = Array.from({ length: numBins }, (_, i) => {
    const start = minVal + i * binSize;
    const end = i === numBins - 1 ? maxVal : minVal + (i + 1) * binSize;
    const x = (start + end) / 2;
    return { x, count: 0, start, end };
  });

  for (const v of clean) {
    let idx = Math.floor((v - minVal) / binSize);
    if (idx < 0) idx = 0;
    if (idx >= numBins) idx = numBins - 1;
    data[idx].count += 1;
  }

  return { data, minVal, maxVal, binSize };
}

/**
 * Mean/Median badges drawn using <Customized />.
 * IMPORTANT: Cast axis objects to `any` to avoid TS2339 errors.
 */
function MeanMedianBadges({
  meanVal,
  medianVal,
}: {
  meanVal: number;
  medianVal: number;
}) {
  return (
    <Customized
      component={(rawProps: unknown) => {
        const props = rawProps as any;

        const xAxisMap = props?.xAxisMap as Record<string, any> | undefined;
        const yAxisMap = props?.yAxisMap as Record<string, any> | undefined;

        const xAxis = xAxisMap ? (Object.values(xAxisMap)[0] as any) : null;
        const yAxis = yAxisMap ? (Object.values(yAxisMap)[0] as any) : null;

        const xScale = xAxis?.scale as ((v: number) => number) | undefined;
        const yScale = yAxis?.scale as ((v: number) => number) | undefined;

        if (!xScale || !yScale) return null;

        const xMean = Number.isFinite(meanVal) ? xScale(meanVal) : null;
        const xMed = Number.isFinite(medianVal) ? xScale(medianVal) : null;

        // Place badges near the top INSIDE the plotting area
        const yDomainMax =
          Array.isArray(yAxis?.domain) && yAxis.domain.length > 1
            ? yAxis.domain[1]
            : 0;

        const yTop = yScale(yDomainMax) + 18;

        const Badge = (x: number, y: number, text: string, color: string) => (
          <g>
            <rect
              x={x + 10}
              y={y - 14}
              width={170}
              height={22}
              rx={11}
              fill="#fff"
              stroke="#e5e7eb"
            />
            <text
              x={x + 22}
              y={y + 2}
              fontSize={12}
              fontWeight={700}
              fill={color}
            >
              {text}
            </text>
          </g>
        );

        return (
          <g>
            {xMean != null &&
              Badge(xMean, yTop, `Mean: ${formatNumber(meanVal)}`, "#ef4444")}
            {xMed != null &&
              Badge(
                xMed,
                yTop + 26,
                `Median: ${formatNumber(medianVal)}`,
                "#111827"
              )}
          </g>
        );
      }}
    />
  );
}

const HistogramChart: React.FC<HistogramChartProps> = ({
  actuals,
  productName,
  bins = 12,
}) => {
  const clean = useMemo(
    () => actuals.filter((v) => Number.isFinite(v)),
    [actuals]
  );

  const m = useMemo(() => mean(clean), [clean]);
  const med = useMemo(() => median(clean), [clean]);

  const sigma = useMemo(() => {
    if (clean.length < 2) return NaN;
    const mu = mean(clean);
    const varSum = clean.reduce((acc, v) => acc + (v - mu) ** 2, 0);
    return Math.sqrt(varSum / (clean.length - 1));
  }, [clean]);

  const { data, minVal, maxVal, binSize } = useMemo(
    () => createHistogramData(clean, bins),
    [clean, bins]
  );

  const maxCount = useMemo(
    () => (data.length ? Math.max(...data.map((d) => d.count)) : 0),
    [data]
  );

  // Padding so first/last bars don't touch the Y-axis / edge
  const domainMin = data.length ? minVal - binSize / 2 : 0;
  const domainMax = data.length ? maxVal + binSize / 2 : 1;

  // Normal curve overlay scaled into histogram "counts" space
  const curve = useMemo(() => {
    if (!data.length || !Number.isFinite(m) || !Number.isFinite(sigma) || sigma <= 0)
      return [];
    const n = clean.length;
    const scale = n * binSize;
    return data.map((b) => ({ x: b.x, y: normalPdf(b.x, m, sigma) * scale }));
  }, [data, m, sigma, clean.length, binSize]);

  if (!data.length) {
    return (
      <div className="empty-state">No actual consumption values available.</div>
    );
  }

  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 50, right: 18, left: 22, bottom: 44 }}
        >
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

          <YAxis
            stroke="#6b7280"
            allowDecimals={false}
            domain={[0, Math.max(1, maxCount + 1)]}
          >
            <Label
              value="Frequency (Months)"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle", fill: "#6b7280" }}
            />
          </YAxis>

          <Tooltip
            formatter={(value: any, name: any) => {
              if (name === "count") return [value, "Months"];
              return [
                Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
                "Curve (scaled)",
              ];
            }}
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

          {/* Lines only */}
          {Number.isFinite(m) && (
            <ReferenceLine x={m} stroke="#ef4444" strokeDasharray="4 4" />
          )}
          {Number.isFinite(med) && (
            <ReferenceLine x={med} stroke="#111827" strokeDasharray="2 6" />
          )}

          {/* Always-visible labels */}
          {Number.isFinite(m) && Number.isFinite(med) && (
            <MeanMedianBadges meanVal={m} medianVal={med} />
          )}

          <Bar dataKey="count" fill="#3b82f6" barSize={28} />

          {/* Normal curve overlay */}
          {curve.length > 0 && (
            <Line
              type="monotone"
              data={curve}
              dataKey="y"
              dot={false}
              stroke="#64748b"
              strokeWidth={2}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
