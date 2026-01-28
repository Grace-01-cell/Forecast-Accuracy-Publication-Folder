import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { RefreshCcw } from "lucide-react";

import ProductSelector from "./components/ProductSelector";
import YearSelector from "./components/YearSelector";
import ForecastTypeToggle from "./components/ForecastTypeToggle";
import MetricTable from "./components/MetricTable";
import HistogramChart from "./components/HistogramChart";
import ThreeYearTable from "./components/ThreeYearTable";
import TrendChart from "./components/TrendChart";
import NarrativeBlock from "./components/NarrativeBlock";

import {
  fetchProducts,
  fetchFysForProduct,
  fetchCompare,
  fetchTrend,
  fetchActuals,
  fetchForecastTypes,
} from "./api";

import type { FyMethodComparisonResponse, TrendResponse, HistoricalData } from "./api";
import type { MetricResult } from "./components/MetricTable";
import type { ThreeYearResultRow } from "./components/ThreeYearTable";

type ViewMode = "one" | "three";

const TARGET_FYS = ["FY23/24", "FY24/25", "FY25/26"];

const App: React.FC = () => {
  const [products, setProducts] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [viewMode, setViewMode] = useState<ViewMode>("one");

  // Forecast Type (Main vs Review)
  const [forecastType, setForecastType] = useState<"Main" | "Review">("Main");
  const [availableForecastTypes, setAvailableForecastTypes] = useState<string[]>([]);

  // 1-year outputs
  const [oneYearCompare, setOneYearCompare] = useState<FyMethodComparisonResponse | null>(null);
  const [oneYearTableRows, setOneYearTableRows] = useState<MetricResult[]>([]);
  const [actuals, setActuals] = useState<HistoricalData | null>(null);

  // 3-year outputs
  const [threeYearRows, setThreeYearRows] = useState<ThreeYearResultRow[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [selectedHistogramFY, setSelectedHistogramFY] = useState<string>("");
  console.log(trend);
  console.log(selectedHistogramFY);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------
  // Load products (once)
  // -----------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoadingProducts(true);
        setError(null);
        const items = await fetchProducts();
        setProducts(items);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load products.");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  // -----------------------------
  // Load forecast types (once)
  // -----------------------------
  useEffect(() => {
    (async () => {
      try {
        const items = await fetchForecastTypes();
        setAvailableForecastTypes(items);
      } catch (e) {
        console.error(e);
        setAvailableForecastTypes(["Main"]);
      }
    })();
  }, []);

  const showForecastToggle = useMemo(() => {
    return availableForecastTypes.includes("Review");
  }, [availableForecastTypes]);

  // -----------------------------
  // Load FY list when product changes
  // -----------------------------
  useEffect(() => {
    if (!selectedProduct) {
      setYears([]);
      setSelectedYear("");
      return;
    }

    (async () => {
      try {
        setLoadingYears(true);
        setError(null);
        const items = await fetchFysForProduct(selectedProduct);
        setYears(items);

        if (items.length > 0) {
          const preferred = items.includes("FY24/25") ? "FY24/25" : items[items.length - 1];
          setSelectedYear(preferred);
        } else {
          setSelectedYear("");
        }

        // Reset forecast type when product changes
        setForecastType("Main");
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load financial years.");
      } finally {
        setLoadingYears(false);
      }
    })();
  }, [selectedProduct]);

  // -----------------------------
  // Helpers
  // -----------------------------
  const resetOutputs = () => {
    setOneYearCompare(null);
    setOneYearTableRows([]);
    setActuals(null);

    setThreeYearRows([]);
    setTrend(null);
    setSelectedHistogramFY("");
  };

  const loadHistogramForFY = async (product: string, fy: string) => {
    try {
      const data = await fetchActuals(product, fy);
      setActuals(data);
    } catch (e) {
      console.error(e);
      setActuals(null);
    }
  };

  const mapCompareToMetricTable = (cmp: FyMethodComparisonResponse): MetricResult[] => {
    return cmp.rows.map((r, idx) => ({
      id: `${cmp.product_name}-${cmp.fy}-${r.method}-${idx}`,
      method_name: r.method + (r.is_adopted ? " (Adopted)" : ""),
      bias: r.bias,
      rmse: r.rmse,
      mape: r.mape,
      count: r.n,
    }));
  };

  const pickSummaryRowsForThreeYears = (t: TrendResponse): ThreeYearResultRow[] => {
    const out: ThreeYearResultRow[] = [];

    for (const fy of t.years) {
      const points = t.points.filter((p) => p.fy === fy);
      if (points.length === 0) continue;

      const adopted = points.find((p) => p.is_adopted);
      const bestRmse = [...points].sort((a, b) => a.rmse - b.rmse)[0];
      const chosen = adopted || bestRmse;

      out.push({
        fy,
        method_name: chosen.method + (chosen.is_adopted ? " (Adopted)" : " (Best RMSE)"),
        bias: chosen.bias,
        rmse: chosen.rmse,
        mape: chosen.mape,
        count: chosen.n,
      });
    }

    const order = [...TARGET_FYS];
    out.sort((a, b) => order.indexOf(a.fy) - order.indexOf(b.fy));

    return out;
  };

  const canRun = useMemo(() => {
    if (!selectedProduct) return false;
    if (loadingRun) return false;
    if (viewMode === "one") return !!selectedYear;
    return true;
  }, [selectedProduct, selectedYear, viewMode, loadingRun]);

  // -----------------------------
  // Run actions
  // -----------------------------
  const handleRunOneYear = async () => {
    if (!selectedProduct || !selectedYear) return;

    setLoadingRun(true);
    setError(null);
    resetOutputs();

    try {
      const [cmp, hist] = await Promise.all([
        fetchCompare(selectedProduct, selectedYear, forecastType),
        fetchActuals(selectedProduct, selectedYear),
      ]);

      if (!cmp) throw new Error("No comparison data found for that product and FY.");

      setOneYearCompare(cmp);
      setOneYearTableRows(mapCompareToMetricTable(cmp));
      setActuals(hist);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to run 1-year accuracy.");
    } finally {
      setLoadingRun(false);
    }
  };

  const handleRunThreeYears = async () => {
    if (!selectedProduct) return;

    setLoadingRun(true);
    setError(null);
    resetOutputs();

    try {
      // keep 3-year always Main (recommended)
      const t = await fetchTrend(selectedProduct, [...TARGET_FYS], "Main");
      if (!t) throw new Error("No 3-year trend data found for that product.");

      setTrend(t);

      const rows = pickSummaryRowsForThreeYears(t);
      setThreeYearRows(rows);

      if (rows.length > 0) {
        const firstFY = rows[0].fy;
        setSelectedHistogramFY(firstFY);
        await loadHistogramForFY(selectedProduct, firstFY);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to run 3-year comparison.");
    } finally {
      setLoadingRun(false);
    }
  };

  const handleRun = async () => {
    if (viewMode === "one") return handleRunOneYear();
    return handleRunThreeYears();
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="dashboard-container">
      <div className="left-panel">
        <div>
          <h1>Forecast Accuracy Dashboard</h1>
          <small>Compare forecast accuracy by product, financial year, and method. FY runs July–June.</small>
        </div>

        <ProductSelector
          products={products}
          selectedProduct={selectedProduct}
          onChange={(value) => {
            setSelectedProduct(value);
            setForecastType("Main");
            setError(null);
            resetOutputs();
          }}
          loading={loadingProducts}
        />

        <YearSelector
          years={years}
          selectedYear={selectedYear}
          onChange={(value) => {
            setSelectedYear(value);
            setForecastType("Main");
            setError(null);
            resetOutputs();
          }}
          loading={loadingYears}
          disabled={!selectedProduct || viewMode === "three"}
        />

        {viewMode === "one" && (
          <div style={{ marginTop: 12 }}>
            <ForecastTypeToggle
              value={forecastType}
              onChange={(v) => {
                setForecastType(v as "Main" | "Review");
                setError(null);
                resetOutputs();
              }}
              show={showForecastToggle}
            />
          </div>
        )}

        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === "one" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setViewMode("one");
              setError(null);
              resetOutputs();
            }}
          >
            1-Year View
          </button>
          <button
            type="button"
            className={viewMode === "three" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setViewMode("three");
              setForecastType("Main");
              setError(null);
              resetOutputs();
            }}
          >
            3-Year Comparison
          </button>
        </div>

        <button className="run-button" onClick={handleRun} disabled={!canRun}>
          {loadingRun ? (
            <>
              <RefreshCcw size={16} style={{ marginRight: 8, verticalAlign: "middle" }} className="spin" />
              Calculating…
            </>
          ) : (
            "Run Accuracy"
          )}
        </button>

        {error && (
          <div style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: 12 }}>
            {error}
          </div>
        )}
      </div>

      <div className="right-panel">
        {viewMode === "one" ? (
          oneYearCompare ? (
            <>
              <h2>
                Method Comparison – {selectedProduct} ({selectedYear}){" "}
                <span style={{ color: "#64748b", fontWeight: 600 }}>• {forecastType}</span>
              </h2>

              <MetricTable results={oneYearTableRows} />

              <h2 style={{ marginTop: "2rem" }}>Historical Consumption Distribution – {selectedYear}</h2>

              {actuals && actuals.actuals.length > 0 ? (
                <div className="chart-container">
                  <HistogramChart actuals={actuals.actuals} productName={actuals.product_name} />
                </div>
              ) : (
                <div className="empty-state">No consumption data available for this product and year.</div>
              )}
            </>
          ) : (
            <div className="empty-state">
              Select a product and financial year on the left, then click <b>Run Accuracy</b>.
            </div>
          )
        ) : threeYearRows.length > 0 ? (
          <>
            <h2>3-Year Forecast Accuracy – {selectedProduct}</h2>

            <ThreeYearTable results={threeYearRows} />

            <h2 style={{ marginTop: "2rem" }}>RMSE &amp; MAPE Trend</h2>
            <TrendChart results={threeYearRows} />

            <NarrativeBlock productName={selectedProduct} results={threeYearRows} />
          </>
        ) : (
          <div className="empty-state">
            Select a product, switch to <b>3-Year Comparison</b>, then click <b>Run Accuracy</b>.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
