import React, { useEffect, useState } from "react";
import "./App.css";
import { RefreshCcw } from "lucide-react";
import ProductSelector from "./components/ProductSelector";
import YearSelector from "./components/YearSelector";
import MetricTable from "./components/MetricTable";
import HistogramChart from "./components/HistogramChart";
import ThreeYearTable from "./components/ThreeYearTable";
import TrendChart from "./components/TrendChart";
import NarrativeBlock from "./components/NarrativeBlock";

// 👇 type-only imports (for TS / Vercel build)
import type { MetricResult } from "./components/MetricTable";
import type { ThreeYearResultRow } from "./components/ThreeYearTable";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";


interface ListResponse {
  items: string[];
}

interface HistoricalData {
  product_name: string;
  fy: string;
  actuals: number[];
}

interface AdoptedAccuracyResponse {
  product_name: string;
  fy: string;
  adopted_method: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number;
}

interface ThreeYearAccuracyResponse {
  product_name: string;
  years: {
    fy: string;
    adopted_method: string;
    bias: number;
    rmse: number;
    mape: number;
    count: number;
  }[];
}

type ViewMode = "one" | "three";

const App: React.FC = () => {
  const [products, setProducts] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [viewMode, setViewMode] = useState<ViewMode>("one");

  const [results, setResults] = useState<MetricResult[]>([]);
  const [actuals, setActuals] = useState<HistoricalData | null>(null);

  const [threeYearResults, setThreeYearResults] = useState<ThreeYearResultRow[]>(
    []
  );
  const [selectedHistogramFY, setSelectedHistogramFY] = useState<string>("");

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const res = await fetch(`${API_BASE_URL}/products`);
        if (!res.ok) throw new Error("Failed to load products");
        const data: ListResponse = await res.json();
        setProducts(data.items);
      } catch (err: any) {
        console.error("Error loading products:", err);
        setError(err.message ?? "Could not load products.");
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // Load FY options when product changes
  useEffect(() => {
    if (!selectedProduct) {
      setYears([]);
      setSelectedYear("");
      return;
    }

    const fetchYears = async () => {
      try {
        setLoadingYears(true);
        const res = await fetch(
          `${API_BASE_URL}/years/${encodeURIComponent(selectedProduct)}`
        );
        if (!res.ok) throw new Error("Failed to load years");
        const data: ListResponse = await res.json();
        setYears(data.items);

        if (!selectedYear && data.items.length > 0) {
          setSelectedYear(data.items[data.items.length - 1]);
        }
      } catch (err: any) {
        console.error("Error loading years:", err);
        setError(err.message ?? "Could not load financial years.");
      } finally {
        setLoadingYears(false);
      }
    };

    fetchYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  const loadHistogramForFY = async (product: string, fyLabel: string) => {
    try {
      const fyParam = encodeURIComponent(fyLabel);
      const prodParam = encodeURIComponent(product);
      const res = await fetch(
        `${API_BASE_URL}/data/actuals/${prodParam}?fy_label=${fyParam}`
      );
      if (!res.ok) {
        const txt = await res.text();
        console.warn("Histogram error:", res.status, txt);
        setActuals(null);
        return;
      }
      const histJson: HistoricalData = await res.json();
      setActuals(histJson);
    } catch (err) {
      console.error("Histogram fetch error:", err);
      setActuals(null);
    }
  };

  const handleCalculateOneYear = async () => {
    if (!selectedProduct || !selectedYear) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setActuals(null);
    setThreeYearResults([]);

    try {
      const fyParam = encodeURIComponent(selectedYear);
      const prodParam = encodeURIComponent(selectedProduct);

      const [accRes, histRes] = await Promise.all([
        fetch(
          `${API_BASE_URL}/fy_adopted_accuracy/${prodParam}?fy_label=${fyParam}`
        ),
        fetch(
          `${API_BASE_URL}/data/actuals/${prodParam}?fy_label=${fyParam}`
        ),
      ]);

      if (!accRes.ok) {
        const bodyText = await accRes.text();
        throw new Error(
          `Accuracy error: ${
            bodyText || `${accRes.status} ${accRes.statusText}`
          }`
        );
      }

      const accJson: AdoptedAccuracyResponse = await accRes.json();
      const row: MetricResult = {
        id: Date.now(),
        method_name: accJson.adopted_method,
        bias: accJson.bias,
        rmse: accJson.rmse,
        mape: accJson.mape,
        count: accJson.count,
      };
      setResults([row]);

      if (histRes.ok) {
        const histJson: HistoricalData = await histRes.json();
        setActuals(histJson);
      } else {
        const bodyText = await histRes.text();
        console.warn("Histogram response:", histRes.status, bodyText);
      }
    } catch (err: any) {
      console.error("Calculation error:", err);
      setError(
        err.message ??
          "Something went wrong while calculating accuracy. Check console."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateThreeYears = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setActuals(null);
    setThreeYearResults([]);
    setSelectedHistogramFY("");

    try {
      const prodParam = encodeURIComponent(selectedProduct);
      const res = await fetch(
        `${API_BASE_URL}/fy_accuracy_3year/${prodParam}`
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(
          `3-year accuracy error: ${txt || res.statusText || res.status}`
        );
      }

      const json: ThreeYearAccuracyResponse = await res.json();

      const mapped: ThreeYearResultRow[] = json.years.map((y) => ({
        fy: y.fy,
        method_name: y.adopted_method,
        bias: y.bias,
        rmse: y.rmse,
        mape: y.mape,
        count: y.count,
      }));

      // Sort FY order: FY23/24, FY24/25, FY25/26
      const order = ["FY23/24", "FY24/25", "FY25/26"];
      mapped.sort(
        (a, b) => order.indexOf(a.fy) - order.indexOf(b.fy)
      );

      setThreeYearResults(mapped);

      if (mapped.length > 0) {
        const firstFY = mapped[0].fy;
        setSelectedHistogramFY(firstFY);
        await loadHistogramForFY(selectedProduct, firstFY);
      }
    } catch (err: any) {
      console.error("3-year calc error:", err);
      setError(
        err.message ??
          "Something went wrong while loading 3-year comparison."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (viewMode === "one") {
      await handleCalculateOneYear();
    } else {
      await handleCalculateThreeYears();
    }
  };

  const canRun =
    !!selectedProduct && !loading && (viewMode === "three" || !!selectedYear);

  return (
    <div className="dashboard-container">
      {/* LEFT PANEL */}
      <div className="left-panel">
        <div>
          <h1>Forecast Accuracy Dashboard</h1>
          <small>
            Explore how the adopted forecasting methodology performs for each
            product and financial year.
          </small>
        </div>

        <ProductSelector
          products={products}
          selectedProduct={selectedProduct}
          onChange={(value) => {
            setSelectedProduct(value);
            setResults([]);
            setActuals(null);
            setError(null);
            setThreeYearResults([]);
            setSelectedHistogramFY("");
          }}
          loading={loadingProducts}
        />

        <YearSelector
          years={years}
          selectedYear={selectedYear}
          onChange={(value) => {
            setSelectedYear(value);
            setResults([]);
            setActuals(null);
            setError(null);
          }}
          loading={loadingYears}
          disabled={!selectedProduct || viewMode === "three"}
        />

        {/* View mode toggle */}
        <div className="view-toggle">
          <button
            type="button"
            className={viewMode === "one" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setViewMode("one");
              setThreeYearResults([]);
              setSelectedHistogramFY("");
            }}
          >
            1-Year View
          </button>
          <button
            type="button"
            className={viewMode === "three" ? "view-btn active" : "view-btn"}
            onClick={() => {
              setViewMode("three");
              setResults([]);
            }}
          >
            3-Year Comparison
          </button>
        </div>

        <button
          className="run-button"
          onClick={handleRun}
          disabled={!canRun}
        >
          {loading ? (
            <>
              <RefreshCcw
                size={16}
                style={{ marginRight: 8, verticalAlign: "middle" }}
                className="spin"
              />
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

        <p
          style={{
            fontSize: "0.75rem",
            color: "#cbd5e1",
            marginTop: error ? 8 : 16,
          }}
        >
          Showing data from FY23/24 onwards (AI era).
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="right-panel">
        {viewMode === "one" ? (
          // ONE-YEAR VIEW
          results.length > 0 || actuals ? (
            <>
              <h2>
                Forecast Accuracy – {selectedProduct || "…"} (
                {selectedYear || "…"})
              </h2>
              <p style={{ color: "#475569", fontSize: "0.9rem" }}>
                Lower RMSE and MAPE are better. Bias near 0 means forecasts are
                well-centered.
              </p>
              {results.length === 1 && (
                <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                  Adopted method for <strong>{selectedProduct}</strong> in{" "}
                  <strong>{selectedYear}</strong> is{" "}
                  <strong>{results[0].method_name}</strong>.
                </p>
              )}

              <MetricTable results={results} />

              <h2 style={{ marginTop: "2rem" }}>
                Historical Consumption Distribution – {selectedYear || "…"}
              </h2>

              {actuals && actuals.actuals.length > 0 ? (
                <div className="chart-container">
                  <HistogramChart
                    actuals={actuals.actuals}
                    productName={actuals.product_name}
                  />
                </div>
              ) : (
                <div className="empty-state">
                  No consumption data available for this product and year.
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              Select a product and financial year on the left, then click{" "}
              <b>Run Accuracy</b> to see results here.
            </div>
          )
        ) : (
          // 3-YEAR VIEW
          <>
            {threeYearResults.length > 0 ? (
              <>
                <h2>3-Year Forecast Accuracy – {selectedProduct}</h2>
                <p style={{ color: "#475569", fontSize: "0.9rem" }}>
                  Comparing Bias, RMSE and MAPE for FY23/24, FY24/25 and
                  FY25/26.
                </p>

                <ThreeYearTable results={threeYearResults} />

                <h2 style={{ marginTop: "2rem" }}>RMSE &amp; MAPE Trend</h2>
                <TrendChart results={threeYearResults} />

                <NarrativeBlock
                  productName={selectedProduct}
                  results={threeYearResults}
                />

                <h2 style={{ marginTop: "2rem" }}>
                  Historical Consumption Distribution
                </h2>
                {threeYearResults.length > 0 && (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label
                      style={{
                        fontSize: "0.85rem",
                        color: "#475569",
                        marginRight: "0.5rem",
                      }}
                    >
                      View FY:
                    </label>
                    <select
                      className="control-select"
                      style={{ maxWidth: "200px", display: "inline-block" }}
                      value={selectedHistogramFY}
                      onChange={async (e) => {
                        const fy = e.target.value;
                        setSelectedHistogramFY(fy);
                        await loadHistogramForFY(selectedProduct, fy);
                      }}
                    >
                      <option value="">Choose FY</option>
                      {threeYearResults.map((r) => (
                        <option key={r.fy} value={r.fy}>
                          {r.fy}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {actuals && actuals.actuals.length > 0 ? (
                  <div className="chart-container">
                    <HistogramChart
                      actuals={actuals.actuals}
                      productName={actuals.product_name}
                    />
                  </div>
                ) : (
                  <div className="empty-state">
                    Choose a financial year above to see consumption
                    distribution.
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                Select a product on the left, switch to{" "}
                <b>3-Year Comparison</b> and click <b>Run Accuracy</b> to see
                trends across FY23/24–FY25/26.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
