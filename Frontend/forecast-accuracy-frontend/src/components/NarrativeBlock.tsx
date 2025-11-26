import React from "react";

import type { ThreeYearResultRow } from "./ThreeYearTable";

interface NarrativeBlockProps {
  productName: string;
  results: ThreeYearResultRow[];
}

const NarrativeBlock: React.FC<NarrativeBlockProps> = ({
  productName,
  results,
}) => {
  if (!results || results.length === 0) return null;

  const sorted = [...results].sort((a, b) => a.fy.localeCompare(b.fy));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const rmseChange = last.rmse - first.rmse;
  const mapeChange = last.mape - first.mape;

  let directionRmse = "";
  if (rmseChange < 0) directionRmse = "decreased";
  else if (rmseChange > 0) directionRmse = "increased";
  else directionRmse = "stayed roughly the same";

  let directionMape = "";
  if (mapeChange < 0) directionMape = "decreased";
  else if (mapeChange > 0) directionMape = "increased";
  else directionMape = "stayed roughly the same";

  const biasCloserToZero =
    Math.abs(last.bias) < Math.abs(first.bias) ? "moved closer to zero" : "did not consistently move closer to zero";

  return (
    <div className="narrative-block">
      <h3>Interpretation</h3>
      <p>
        For <strong>{productName}</strong>, forecast accuracy across{" "}
        <strong>{sorted.map((r) => r.fy).join(", ")}</strong> shows that RMSE{" "}
        <strong>{directionRmse}</strong> from{" "}
        <strong>
          {first.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </strong>{" "}
        in {first.fy} to{" "}
        <strong>
          {last.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </strong>{" "}
        in {last.fy}.
      </p>
      <p>
        Over the same period, MAPE <strong>{directionMape}</strong> from{" "}
        <strong>
          {first.mape.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          %
        </strong>{" "}
        to{" "}
        <strong>
          {last.mape.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          %
        </strong>
        .
      </p>
      <p>
        Bias has <strong>{biasCloserToZero}</strong>, indicating that forecasts{" "}
        {biasCloserToZero === "moved closer to zero"
          ? "have become better centered around actual demand."
          : "still exhibit some systematic over- or under-forecasting."}
      </p>
      <p>
        The adopted methods changed from{" "}
        <strong>{first.method_name}</strong> in {first.fy} to{" "}
        <strong>{last.method_name}</strong> in {last.fy}, which may have
        contributed to the observed changes in accuracy.
      </p>
    </div>
  );
};

export default NarrativeBlock;
