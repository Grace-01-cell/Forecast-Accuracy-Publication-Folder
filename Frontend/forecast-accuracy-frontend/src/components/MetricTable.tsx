import React from "react";

/**
 * One row of forecast accuracy metrics.
 * For now we only ever show the adopted method, but this still supports multiple rows.
 */
export interface MetricResult {
  id: number;
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
  if (!results || results.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-500">
        Run an accuracy calculation to see the adopted method and its forecast
        accuracy here.
      </div>
    );
  }

  // we still support multiple rows, but in your case this will usually be 1
  const minRMSE = Math.min(...results.map((r) => r.rmse));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Method
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Bias
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              RMSE
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              MAPE (%)
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
              N
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {results.map((row, idx) => {
            const isBestRmse = row.rmse === minRMSE;
            const isAdopted = idx === 0; // in your flow the first row is the adopted method

            return (
              <tr
                key={row.id}
                className={isAdopted ? "bg-emerald-50/60" : ""}
              >
                {/* Method name + adopted badge */}
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <span>{row.method_name}</span>
                    {isAdopted && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Adopted method
                      </span>
                    )}
                  </div>
                </td>

                {/* Bias */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                  {row.bias.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </td>

                {/* RMSE */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                  <span
                    className={
                      "font-semibold " + (isBestRmse ? "text-emerald-700" : "text-slate-800")
                    }
                  >
                    {row.rmse.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                    {isBestRmse && (
                      <span className="ml-1 text-[11px] text-emerald-600">
                        (lowest)
                      </span>
                    )}
                  </span>
                </td>

                {/* MAPE */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-800">
                  {row.mape.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </td>

                {/* N */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-500">
                  {row.count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MetricTable;
