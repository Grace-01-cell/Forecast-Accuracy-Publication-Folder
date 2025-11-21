// src/App.tsx
import React, { useEffect, useState } from "react";
import "./App.css";
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

const App: React.FC = () => {
  const [products, setProducts] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

  const [results, setResults] = useState<MetricResult[]>([]);
  const [actuals, setActuals] = useState<HistoricalData | null>(null);

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

  // Load financial years whenever product changes
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

        // Auto-select last (most recent) FY if nothing selected
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

  const handleCalculate = async () => {
    if (!selectedProduct || !selectedYear) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setActuals(null);

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
        console.error("Accuracy response:", accRes.status, bodyText);
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
          disabled={!selectedProduct}
        />

        <button
          className="run-button"
          onClick={handleCalculate}
          disabled={!selectedProduct || !selectedYear || loading}
        >
          {loading ? (
            <>
              <RefreshCcw
                size={16}
                style={{ marginRight: 8, verticalAlign: "middle" }}
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
        {results.length > 0 || actuals ? (
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
        )}
      </div>
    </div>
  );
};

export default App;
