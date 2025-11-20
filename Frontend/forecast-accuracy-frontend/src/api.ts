// src/api.ts
export const API_BASE_URL = "http://127.0.0.1:8000";

export interface AccuracyMetrics {
  product_name: string;
  method_name: string;
  bias: number;
  rmse: number;
  mape: number;
  count: number;
}

export interface MetricResult extends AccuracyMetrics {
  id: string;
}

export interface HistoricalData {
  product_name: string;
  actuals: number[];
}

// ---------- Overall (FY 2023+ pooled) endpoints (existing) ----------

export const fetchAccuracy = async (
  product: string,
  method: string
): Promise<MetricResult | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/accuracy/${encodeURIComponent(
        product
      )}/${encodeURIComponent(method)}`
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("API error");

    const data: AccuracyMetrics = await response.json();
    return { ...data, id: `${product}-${method}` };
  } catch (err) {
    console.error("Error fetching accuracy:", err);
    return null;
  }
};

export const fetchActuals = async (
  product: string
): Promise<HistoricalData | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/data/actuals/${encodeURIComponent(product)}`
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("API error");

    return await response.json();
  } catch (err) {
    console.error("Error fetching actuals:", err);
    return null;
  }
};

// ---------- NEW: Financial year endpoints ----------

// List FYs as strings (e.g. ["2023", "2024"])
export const fetchYearsForProduct = async (
  product: string
): Promise<string[]> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/years/${encodeURIComponent(product)}`
    );

    if (response.status === 404) {
      console.warn(`No years found for product: ${product}`);
      return [];
    }
    if (!response.ok) throw new Error("API error");

    const data = await response.json(); // { items: [...] }
    return data.items ?? [];
  } catch (err) {
    console.error("Error fetching years:", err);
    return [];
  }
};

// FY-specific accuracy
export const fetchFyAccuracy = async (
  product: string,
  method: string,
  fy: number
): Promise<MetricResult | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/fy_accuracy/${encodeURIComponent(
        product
      )}/${encodeURIComponent(method)}/${fy}`
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("API error");

    const data: AccuracyMetrics = await response.json();
    return { ...data, id: `${product}-${method}-fy${fy}` };
  } catch (err) {
    console.error("Error fetching FY accuracy:", err);
    return null;
  }
};

// FY-specific actuals for histogram
export const fetchFyActuals = async (
  product: string,
  fy: number
): Promise<HistoricalData | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/data/actuals/${encodeURIComponent(product)}/${fy}`
    );

    if (response.status === 404) {
      console.warn(`No actuals for ${product} in FY ${fy}`);
      return null;
    }
    if (!response.ok) throw new Error("API error");

    return await response.json();
  } catch (err) {
    console.error("Error fetching FY actuals:", err);
    return null;
  }
};
