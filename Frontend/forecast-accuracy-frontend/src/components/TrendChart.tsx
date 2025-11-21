import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ThreeYearResultRow } from "./ThreeYearTable";

interface TrendChartProps {
  results: ThreeYearResultRow[];
}

const TrendChart: React.FC<TrendChartProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  const data = results.map((r) => ({
    fy: r.fy,
    rmse: r.rmse,
    mape: r.mape,
  }));

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="fy" stroke="#6b7280" />
          <YAxis
            stroke="#6b7280"
            tickFormatter={(value) =>
              (value as number).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })
            }
          />
          <Tooltip
            formatter={(value: any, name: any) => [
              (value as number).toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
              name === "rmse" ? "RMSE" : "MAPE (%)",
            ]}
          />
          <Legend />
          <Line type="monotone" dataKey="rmse" name="RMSE" stroke="#3b82f6" />
          <Line type="monotone" dataKey="mape" name="MAPE (%)" stroke="#10b981" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
