
import React, { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";

import ProductSelector from "./components/ProductSelector";
import YearSelector from "./components/YearSelector";
import MetricTable, { MetricResult } from "./components/MetricTable";
import HistogramChart from "./components/HistogramChart";

const API_BASE_URL = "http://127.0.0.1:8000";

interface ListResponse {
  items: string[];
}

interface HistoricalData {
  product_name: string;
  fy: number;
  actuals: number[];
}

interface AdoptedAccuracyResponse {
  product_name: string;
  fy: number;
  adopted_method: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number;
}

const App: React.FC = () => {
  const [products, setProducts] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [results, setResults] = useState<MetricResult[]>([]);
  const [actuals, setActuals] = useState<HistoricalData | null>(null);

  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [loadingYears, setLoadingYears] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load products on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const res = await fetch(`${API_BASE_URL}/products`);
        if (!res.ok) {
          throw new Error("Failed to load products");
        }
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

  // ---------------------------------------------------------------------------
  // Load financial years whenever a product is selected
  // ---------------------------------------------------------------------------
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
        if (!res.ok) {
          throw new Error("Failed to load financial years");
        }
        const data: ListResponse = await res.json();
        setYears(data.items);
        // auto-select the most recent year if none selected
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

  // ---------------------------------------------------------------------------
  // Run accuracy + histogram for adopted method
  // ---------------------------------------------------------------------------
  const handleCalculate = async () => {
    if (!selectedProduct || !selectedYear) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setActuals(null);

    try {
      const [accRes, histRes] = await Promise.all([
        fetch(
          `${API_BASE_URL}/fy_adopted_accuracy/${encodeURIComponent(
            selectedProduct
          )}/${selectedYear}`
        ),
        fetch(
          `${API_BASE_URL}/data/actuals/${encodeURIComponent(
            selectedProduct
          )}/${selectedYear}`
        ),
      ]);

      if (!accRes.ok) {
        const errBody = await accRes.json().catch(() => null);
        const msg =
          errBody && errBody.detail
            ? `Accuracy error: ${errBody.detail}`
            : "Failed to calculate accuracy.";
        throw new Error(msg);
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
        // histogram is optional; just log if it fails
        const errBody = await histRes.json().catch(() => null);
        console.warn("Histogram error:", errBody);
      }
    } catch (err: any) {
      console.error("Calculation error:", err);
      setError(
        err.message ??
          "Something went wrong while calculating forecast accuracy."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-6xl w-full bg-white rounded-3xl shadow-xl grid lg:grid-cols-[1.2fr_1.8fr] overflow-hidden">
        {/* LEFT: filters / controls */}
        <div className="bg-slate-900 text-slate-50 p-8 space-y-6 flex flex-col">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">
              Forecast Accuracy Dashboard
            </h1>
            <p className="text-slate-200 text-sm leading-relaxed">
              Explore how the adopted forecasting methodology performs for each
              product and financial year using Bias, RMSE, and MAPE, plus the
              distribution of actual consumption.
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {/* Product selector */}
            <ProductSelector
              products={products}
              selectedProduct={selectedProduct}
              onChange={(value) => {
                setSelectedProduct(value);
                setResults([]);
                setActuals(null);
                setError(null);
              }}
              loading={loadingProducts}
            />

            {/* FY selector */}
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
              disabled={!selectedProduct}
            />

            <p className="text-xs text-slate-300">
              Showing data from FY 2023 onwards (AI era).
            </p>

            <button
              onClick={handleCalculate}
              className="mt-2 inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-500/40 hover:bg-emerald-600 transition disabled:bg-slate-500 disabled:shadow-none"
              disabled={loading || !selectedProduct || !selectedYear}
            >
              {loading ? (
                <>
                  <RefreshCcw className="w-5 h-5 mr-2 animate-spin" />
                  Calculating…
                </>
              ) : (
                "Run Accuracy"
              )}
            </button>

            {error && (
              <div className="mt-2 text-xs bg-rose-500/10 border border-rose-500/40 text-rose-100 rounded-md p-2">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: results */}
        <div className="p-8 space-y-6 bg-slate-50">
          {results.length > 0 || actuals ? (
            <>
              {/* Accuracy summary for adopted method */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">
                  Forecast Accuracy – {selectedProduct || "…"} (FY{" "}
                  {selectedYear || "…"})
                </h2>
                <p className="text-sm text-slate-600">
                  Lower RMSE and MAPE are better. Bias near 0 means forecasts
                  are well-centered.
                </p>
                {results.length === 1 && (
                  <p className="text-xs text-slate-500">
                    Adopted method for <strong>{selectedProduct}</strong> in FY{" "}
                    <strong>{selectedYear}</strong> is{" "}
                    <strong>{results[0].method_name}</strong>.
                  </p>
                )}
              </div>

              <MetricTable results={results} />

              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">
                  Historical Consumption Distribution – FY{" "}
                  {selectedYear || "…"}
                </h2>
                <p className="text-sm text-slate-600">
                  See how volatile or stable demand has been for this product in
                  the selected financial year.
                </p>
                {actuals && actuals.actuals.length > 0 ? (
                  <HistogramChart
                    actuals={actuals.actuals}
                    productName={actuals.product_name}
                  />
                ) : (
                  <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">
                    No consumption data available for this product and year.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-slate-500 text-sm bg-white border border-dashed border-slate-300 rounded-2xl p-8">
                Select a product and financial year on the left, then click{" "}
                <span className="font-semibold">Run Accuracy</span> to see
                results here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
