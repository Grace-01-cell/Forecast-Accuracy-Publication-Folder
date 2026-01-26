import React, { useMemo } from "react";

export interface ThreeYearResultRow {
  fy: string;
  method_name: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number; // months
}

interface ThreeYearTableProps {
  results: ThreeYearResultRow[];
}

const fmt = (n: number, dp = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: dp })
    : "—";

const ThreeYearTable: React.FC<ThreeYearTableProps> = ({ results }) => {
  if (!results || results.length === 0) return null;

  const { full, partial } = useMemo(() => {
    const fullYears = results.filter((r) => (r.count ?? 0) >= 12);
    const partialYears = results.filter((r) => (r.count ?? 0) > 0 && (r.count ?? 0) < 12);

    fullYears.sort((a, b) => a.fy.localeCompare(b.fy));
    partialYears.sort((a, b) => a.fy.localeCompare(b.fy));

    return { full: fullYears, partial: partialYears };
  }, [results]);

  const minRmseFull = full.length ? Math.min(...full.map((r) => r.rmse)) : NaN;

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
        {full.map((r) => (
          <tr key={r.fy}>
            <td>{r.fy}</td>
            <td>{r.method_name}</td>
            <td>{fmt(r.bias, 2)}</td>
            <td>
              {fmt(r.rmse, 2)}
              {r.rmse === minRmseFull ? " ★" : ""}
            </td>
            <td>{fmt(r.mape, 2)}</td>
            <td>{r.count}</td>
          </tr>
        ))}

        {partial.length > 0 && (
          <>
            <tr>
              <td colSpan={6} style={{ paddingTop: 14, fontWeight: 700, color: "#334155" }}>
                Partial year (not included in full-year comparison)
              </td>
            </tr>
            {partial.map((r) => (
              <tr key={r.fy}>
                <td>{r.fy}</td>
                <td>
                  {r.method_name} <span style={{ color: "#64748b" }}>(Partial)</span>
                </td>
                <td>{fmt(r.bias, 2)}</td>
                <td>{fmt(r.rmse, 2)}</td>
                <td>{fmt(r.mape, 2)}</td>
                <td>{r.count}</td>
              </tr>
            ))}
          </>
        )}
      </tbody>
    </table>
  );
};

export default ThreeYearTable;
