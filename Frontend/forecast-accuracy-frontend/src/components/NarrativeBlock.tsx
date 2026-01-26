import React, { useMemo } from "react";
import type { ThreeYearResultRow } from "./ThreeYearTable";

interface NarrativeBlockProps {
  productName: string;
  results: ThreeYearResultRow[];
}

const fmt = (n: number, dp = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: dp })
    : "—";

function direction(from: number, to: number) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "changed";
  if (to > from) return "increased";
  if (to < from) return "decreased";
  return "stayed about the same";
}

const NarrativeBlock: React.FC<NarrativeBlockProps> = ({ productName, results }) => {
  if (!results || results.length === 0) return null;

  const { full, partial } = useMemo(() => {
    const fullYears = results.filter((r) => (r.count ?? 0) >= 12).sort((a, b) => a.fy.localeCompare(b.fy));
    const partialYears = results.filter((r) => (r.count ?? 0) > 0 && (r.count ?? 0) < 12).sort((a, b) => a.fy.localeCompare(b.fy));
    return { full: fullYears, partial: partialYears };
  }, [results]);

  if (full.length < 2) {
    return (
      <div className="narrative-block">
        <h3>Interpretation</h3>
        <p style={{ marginBottom: 0 }}>
          Not enough full-year data to make a fair comparison yet.
        </p>
        {partial.length > 0 && (
          <p style={{ color: "#64748b", marginTop: 8 }}>
            FY25/26 is partial ({partial[0].count} months), so treat it cautiously.
          </p>
        )}
      </div>
    );
  }

  const first = full[0];
  const last = full[full.length - 1];

  const rmseDir = direction(first.rmse, last.rmse);
  const mapeDir = direction(first.mape, last.mape);

  const biasDir =
    Math.abs(last.bias) < Math.abs(first.bias)
      ? "closer to zero"
      : "not closer to zero";

  return (
    <div className="narrative-block">
      <h3>Interpretation</h3>

      <p style={{ marginBottom: 8 }}>
        For <strong>{productName}</strong>, comparing full financial years{" "}
        <strong>{full.map((r) => r.fy).join(" vs ")}</strong>: RMSE{" "}
        <strong>{rmseDir}</strong> (from <strong>{fmt(first.rmse, 2)}</strong> to{" "}
        <strong>{fmt(last.rmse, 2)}</strong>).
      </p>

      <p style={{ marginBottom: 8 }}>
        MAPE <strong>{mapeDir}</strong> (from <strong>{fmt(first.mape, 2)}%</strong>{" "}
        to <strong>{fmt(last.mape, 2)}%</strong>). Bias is <strong>{biasDir}</strong>.
      </p>

      {partial.length > 0 && (
        <p style={{ marginBottom: 0, color: "#64748b" }}>
          <strong>Note:</strong> {partial.map((p) => `${p.fy} is partial (${p.count} months)`).join("; ")} and is shown separately.
        </p>
      )}
    </div>
  );
};

export default NarrativeBlock;
