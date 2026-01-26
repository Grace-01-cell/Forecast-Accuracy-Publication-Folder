import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { ThreeYearResultRow } from "./ThreeYearTable";

interface TrendChartProps {
  results: ThreeYearResultRow[];
}

/** Compact Y-axis labels: 1200 -> 1k, 1500000 -> 1.5M */
const formatCompact = (v: number) => {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
};

const TrendChart: React.FC<TrendChartProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  // Sort FYs to keep consistent x-axis order
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => a.fy.localeCompare(b.fy));
  }, [results]);

  // If you are now excluding FY25/26 from "full FY" trend, keep only FY23/24 + FY24/25
  // (Assuming FY25/26 is partial in your context)
  const fullFYs = useMemo(() => {
    return sorted.filter((r) => r.fy !== "FY25/26");
  }, [sorted]);

  const rmseData = useMemo(
    () =>
      fullFYs.map((r) => ({
        fy: r.fy,
        rmse: r.rmse,
      })),
    [fullFYs]
  );

  const mapeData = useMemo(
    () =>
      fullFYs.map((r) => ({
        fy: r.fy,
        mape: r.mape,
      })),
    [fullFYs]
  );

  return (
    <div
      className="trend-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        alignItems: "stretch",
      }}
    >
      {/* RMSE Chart */}
      <div style={{ width: "100%", height: 260 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>RMSE Trend (Full FYs)</h3>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rmseData}
            margin={{ top: 10, right: 10, left: 25, bottom: 35 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis dataKey="fy" stroke="#6b7280" interval={0} />

            <YAxis
              width={60}
              tickCount={5}
              stroke="#6b7280"
              tickFormatter={(v) => formatCompact(Number(v))}
            />

            <Tooltip
              formatter={(value: any) => [
                Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
                "RMSE",
              ]}
            />

            <Line type="monotone" dataKey="rmse" name="RMSE" stroke="#3b82f6" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MAPE Chart */}
      <div style={{ width: "100%", height: 260 }}>
        <h3 style={{ margin: "0 0 8px 0" }}>MAPE (%) Trend (Full FYs)</h3>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={mapeData}
            margin={{ top: 10, right: 10, left: 25, bottom: 35 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

            <XAxis dataKey="fy" stroke="#6b7280" interval={0} />

            <YAxis
              width={60}
              tickCount={5}
              stroke="#6b7280"
              tickFormatter={(v) => formatCompact(Number(v))}
            />

            <Tooltip
              formatter={(value: any) => [
                Number(value).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                }),
                "MAPE (%)",
              ]}
            />

            <Line type="monotone" dataKey="mape" name="MAPE (%)" stroke="#10b981" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Note */}
      <div style={{ gridColumn: "1 / -1", color: "#64748b", fontSize: 13 }}>
        Note: FY25/26 is partial (6 months). It’s shown separately and not used in the full-year trend.
      </div>
    </div>
  );
};

export default TrendChart;
