// src/components/MetricTable.tsx
import React from "react";

export interface MetricResult {
  id: string;
  method_name: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number;
}

interface MetricTableProps {
  results: MetricResult[];
}

const MetricTable: React.FC<MetricTableProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  const minRmse = Math.min(...results.map((r) => r.rmse));

  return (
    <table className="metric-table">
      <thead>
        <tr>
          <th>Method</th>
          <th>Bias</th>
          <th>RMSE</th>
          <th>MAPE (%)</th>
          <th>N</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.id}>
            <td>{r.method_name}</td>
            <td>{r.bias.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td>
              {r.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              {r.rmse === minRmse && " "}
            </td>
            <td>{r.mape.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MetricTable;
