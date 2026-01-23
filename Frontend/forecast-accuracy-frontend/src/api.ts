// src/api.ts
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// ---- Types ----
export interface ListResponse {
  items: string[];
}

export type ForecastType = "Main" | "Review";

export interface AccuracyRow {
  product_name: string;
  fy: string;
  forecast_type: string;
  method: string;
  bias: number;
  rmse: number;
  mape: number;
  wape?: number;
  n: number;
  is_adopted: boolean;
  is_ai?: boolean;
}

export interface FyMethodComparisonResponse {
  product_name: string;
  fy: string;
  forecast_type: string;
  rows: AccuracyRow[];
}

export interface TrendPoint {
  fy: string;
  forecast_type: string;
  method: string;
  rmse: number;
  mape: number;
  wape?: number;
  bias: number;
  n: number;
  is_adopted: boolean;
  is_ai?: boolean;
}

export interface TrendResponse {
  product_name: string;
  years: string[];
  forecast_type: string;
  points: TrendPoint[];
}

export interface HistoricalData {
  product_name: string;
  fy: string;
  actuals: number[];
}

// ---- helper: fetch with timeout ----
async function fetchWithTimeout(url: string, ms = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ---- API calls ----
export async function fetchProducts(): Promise<string[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/products`);
  if (!res.ok) throw new Error(await res.text());
  const data: ListResponse = await res.json();
  return data.items || [];
}

export async function fetchFysForProduct(product: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/fys/${encodeURIComponent(product)}`
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(await res.text());
  const data: ListResponse = await res.json();
  return data.items || [];
}

/**
 * New: fetch available forecast types from backend
 * GET /forecast-types -> { items: ["Main","Review"] }
 */
export async function fetchForecastTypes(): Promise<string[]> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/forecast-types`);
  if (res.status === 404) return ["Main"];
  if (!res.ok) throw new Error(await res.text());
  const data: ListResponse = await res.json();
  return data.items || ["Main"];
}

/**
 * Updated: now accepts forecastType (Main/Review)
 * GET /compare/{product}?fy=FY24/25&forecast_type=Main
 */
export async function fetchCompare(
  product: string,
  fy: string,
  forecastType: ForecastType = "Main"
) {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/compare/${encodeURIComponent(product)}?fy=${encodeURIComponent(
      fy
    )}&forecast_type=${encodeURIComponent(forecastType)}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as FyMethodComparisonResponse;
}

/**
 * Updated: now accepts forecastType (Main/Review)
 * GET /trend/{product}?forecast_type=Main&years=FY23/24&years=FY24/25...
 */
export async function fetchTrend(
  product: string,
  years: string[],
  forecastType: ForecastType = "Main"
) {
  const qsYears = years.map((y) => `years=${encodeURIComponent(y)}`).join("&");
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/trend/${encodeURIComponent(
      product
    )}?forecast_type=${encodeURIComponent(forecastType)}&${qsYears}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as TrendResponse;
}

export async function fetchActuals(product: string, fy: string) {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/actuals/${encodeURIComponent(product)}?fy=${encodeURIComponent(
      fy
    )}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as HistoricalData;
}
