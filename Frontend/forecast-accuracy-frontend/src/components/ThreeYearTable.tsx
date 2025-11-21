import React from "react";

export interface ThreeYearResultRow {
  fy: string;
  method_name: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number;
}

interface ThreeYearTableProps {
  results: ThreeYearResultRow[];
}

const ThreeYearTable: React.FC<ThreeYearTableProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  const minRmse = Math.min(...results.map((r) => r.rmse));

  return (
    <table className="metric-table">
      <thead>
        <tr>
          <th>FY</th>
          <th>Method</th>
          <th>Bias</th>
          <th>RMSE</th>
          <th>MAPE (%)</th>
          <th>N</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.fy}>
            <td>{r.fy}</td>
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

export default ThreeYearTable;
