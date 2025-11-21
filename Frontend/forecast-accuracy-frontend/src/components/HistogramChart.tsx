import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface HistogramBin {
  range: string;
  count: number;
}

interface HistogramChartProps {
  actuals: number[];
  productName: string;
}

const formatNumber = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

const createHistogramData = (actuals: number[]): HistogramBin[] => {
  if (!actuals || actuals.length === 0) return [];

  const maxVal = Math.max(...actuals);
  const minVal = Math.min(...actuals);
  const numBins = 10;
  const range = maxVal - minVal;

  if (range < 0.001) {
    return [
      {
        range: formatNumber(minVal),
        count: actuals.length,
      },
    ];
  }

  const binSize = range / numBins;

  const bins: HistogramBin[] = Array(numBins)
    .fill(0)
    .map((_, i) => {
      const start = minVal + i * binSize;
      const end = minVal + (i + 1) * binSize;
      return {
        range: `${formatNumber(start)} - ${formatNumber(end)}`,
        count: 0,
      };
    });

  actuals.forEach((val) => {
    let idx = Math.floor((val - minVal) / binSize);
    if (idx >= numBins) idx = numBins - 1;
    if (idx >= 0) bins[idx].count += 1;
  });

  return bins;
};

const HistogramChart: React.FC<HistogramChartProps> = ({
  actuals,
  productName,
}) => {
  const data = createHistogramData(actuals);

  return (
    <div style={{ width: "100%", height: 330 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="range"
            angle={-45}
            textAnchor="end"
            interval={0}
            height={70}
            stroke="#6b7280"
          >
            <Label
              value={`Historical Consumption (${productName})`}
              position="bottom"
              offset={0}
              style={{ fill: "#6b7280" }}
            />
          </XAxis>
          <YAxis
            stroke="#6b7280"
            allowDecimals={false}
            tickFormatter={(value) =>
              (value as number).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })
            }
          >
            <Label
              value="Frequency (Periods)"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: "middle", fill: "#6b7280" }}
            />
          </YAxis>
          <Tooltip
            formatter={(value: any) => [value, "Periods"]}
            labelFormatter={(label: string) => `Range: ${label}`}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #d1d5db",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
          <Bar dataKey="count" name="Historical Frequency" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
