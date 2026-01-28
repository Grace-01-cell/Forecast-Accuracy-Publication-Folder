from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Dict, Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# -----------------------------
# Config
# -----------------------------
APP_TITLE = "Forecast Accuracy API"
CSV_FILENAME = "FA Publication Methodology Working Space.csv"
TARGET_FYS = ["FY23/24", "FY24/25", "FY25/26"]


# -----------------------------
# App
# -----------------------------
app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://fp-forecast-accuracy-publication-vg62z.ondigitalocean.app/"
    ],
    # allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Models
# -----------------------------
class ListResponse(BaseModel):
    items: List[str]


class AccuracyRow(BaseModel):
    product_name: str
    fy: str
    forecast_type: str
    method: str
    bias: float
    rmse: float
    mape: float
    wape: float
    n: int
    is_adopted: bool
    is_ai: bool


class FyMethodComparisonResponse(BaseModel):
    product_name: str
    fy: str
    forecast_type: str
    rows: List[AccuracyRow]


class TrendPoint(BaseModel):
    fy: str
    forecast_type: str
    method: str
    rmse: float
    mape: float
    wape: float
    bias: float
    n: int
    is_adopted: bool
    is_ai: bool


class TrendResponse(BaseModel):
    product_name: str
    years: List[str]
    forecast_type: str
    points: List[TrendPoint]


class HistoricalData(BaseModel):
    product_name: str
    fy: str
    actuals: List[float]


# -----------------------------
# Helpers
# -----------------------------
def cached_json(data: Any, seconds: int = 60) -> JSONResponse:
    resp = JSONResponse(content=data)
    resp.headers["Cache-Control"] = f"public, max-age={seconds}"
    return resp


def fy_from_date(d: pd.Timestamp) -> str:
    """Financial year is July -> June. Example: 2023-07 belongs to FY23/24."""
    if pd.isna(d):
        return ""
    y = d.year
    if d.month >= 7:
        return f"FY{str(y)[-2:]}/{str(y + 1)[-2:]}"
    return f"FY{str(y - 1)[-2:]}/{str(y)[-2:]}"


def is_ai_method(method: str) -> bool:
    m = (method or "").strip().lower()
    return ("ai" in m) or ("lmis" in m) or ("lm" in m)


def to_num(series: pd.Series) -> pd.Series:
    """Robust numeric parsing for CSV/Excel weirdness."""
    s = series.astype(str).str.strip()
    s = s.str.replace(",", "", regex=False)
    s = s.replace({"": np.nan, "nan": np.nan, "None": np.nan, "N/A": np.nan, "NA": np.nan, "-": np.nan})
    return pd.to_numeric(s, errors="coerce")


def normalize_forecast_type(ft_series: pd.Series) -> pd.Series:
    """Force forecast type into exactly: Main / Review"""
    ft = ft_series.astype(str).str.strip().str.lower()
    return np.where(ft.str.contains("review"), "Review", "Main")


def parse_period_to_date(period_series: pd.Series) -> pd.Series:
    """
    Parse Period robustly.
    Supports:
      - Excel serial dates (45123)
      - dd/mm/yyyy
      - yyyy-mm-dd
      - yyyy-mm
      - Jul-23 / Jul 2023
      - datetime strings with time
    """
    p = period_series

    # 1) Excel serial (1900 system)
    p_num = pd.to_numeric(p, errors="coerce")
    date_1900 = pd.to_datetime(p_num, unit="D", origin="1899-12-30", errors="coerce")

    # 2) Excel serial (1904 system, rare)
    date_1904 = pd.to_datetime(p_num, unit="D", origin="1904-01-01", errors="coerce")

    # 3) String parsing
    s = p.astype(str).str.strip()

    # Handle "YYYY-MM" by appending "-01"
    s_ym = s.where(~s.str.match(r"^\d{4}-\d{2}$"), s + "-01")

    # Handle "Jul-23" / "Jul 23" / "Jul-2023" / "Jul 2023" by appending day
    # Convert "Jul-23" -> "01-Jul-23"
    s_mmyy = s_ym.where(
        ~s_ym.str.match(r"^[A-Za-z]{3,9}[-\s]\d{2,4}$"),
        "01-" + s_ym.str.replace(" ", "-", regex=False),
    )

    date_str = pd.to_datetime(s_mmyy, errors="coerce", dayfirst=True)

    # Combine: use anything that works
    out = date_1900.fillna(date_1904).fillna(date_str)
    return out


def compute_metrics(sub: pd.DataFrame) -> Dict[str, float]:
    actual = sub["actual_num"].to_numpy(dtype=float)
    forecast = sub["forecast_num"].to_numpy(dtype=float)
    errors = forecast - actual

    bias = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean(errors**2)))

    denom = np.where(actual == 0, np.nan, actual)
    mape = float(np.nanmean(np.abs(errors) / denom) * 100.0)

    abs_err_sum = float(np.nansum(np.abs(errors)))
    actual_sum = float(np.nansum(np.abs(actual)))
    wape = float((abs_err_sum / actual_sum) * 100.0) if actual_sum != 0 else float("nan")

    n = int(len(sub))
    return {"bias": bias, "rmse": rmse, "mape": mape, "wape": wape, "n": n}


# -----------------------------
# Load + reshape
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / CSV_FILENAME

if not CSV_PATH.exists():
    raise RuntimeError(f"CSV file not found: {CSV_PATH}")

wide = pd.read_csv(CSV_PATH)
wide.columns = [c.strip() for c in wide.columns]

required = {"product", "Period", "Actual Consumption", "Forecast Type", "Adopted"}
missing = required - set(wide.columns)
if missing:
    raise RuntimeError(f"Missing required columns in CSV: {sorted(missing)}")

id_vars = ["product", "Period", "Actual Consumption", "Forecast Type", "Adopted"]
method_cols = [c for c in wide.columns if c not in id_vars]
if not method_cols:
    raise RuntimeError("No method columns found. Your CSV might not include forecast method columns.")

long = wide.melt(
    id_vars=id_vars,
    value_vars=method_cols,
    var_name="method",
    value_name="forecast",
)

# Clean strings
long["product_clean"] = long["product"].astype(str).str.strip().str.upper()
long["method_clean"] = long["method"].astype(str).str.strip()
long["adopted_method"] = long["Adopted"].astype(str).str.strip()

# Normalize forecast type to Main/Review
long["forecast_type"] = normalize_forecast_type(long["Forecast Type"])

# Parse Period robustly
long["date"] = parse_period_to_date(long["Period"])
long["fy"] = long["date"].apply(fy_from_date)

# Numeric
long["actual_num"] = to_num(long["Actual Consumption"])
long["forecast_num"] = to_num(long["forecast"])

# Flags
long["is_adopted"] = long["method_clean"].eq(long["adopted_method"])
long["is_ai"] = long["method_clean"].apply(is_ai_method)

# IMPORTANT: Do NOT require FY for product lists (so products never disappear)
# Only require product + method + forecast numeric.
long_for_lists = long.dropna(subset=["product_clean", "method_clean", "forecast_num"]).copy()

# Metrics require actuals + FY present
metrics_df = long_for_lists.dropna(subset=["actual_num"]).copy()
metrics_df = metrics_df[metrics_df["fy"].astype(str).str.strip() != ""]


def get_product_subset_metrics(product: str) -> pd.DataFrame:
    p = product.strip().upper()
    sub = metrics_df[metrics_df["product_clean"] == p].copy()
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"No usable (actual+forecast) data for product '{product}'")
    return sub


# -----------------------------
# Routes
# -----------------------------
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": APP_TITLE,
        "endpoints": [
            "/products",
            "/fys/{product}",
            "/forecast-types",
            "/methods",
            "/compare/{product}?fy=FY23/24&forecast_type=Main",
            "/trend/{product}?forecast_type=Main&years=FY23/24&years=FY24/25&years=FY25/26",
            "/actuals/{product}?fy=FY23/24",
            "/debug/health",
        ],
    }


@app.get("/debug/health")
def debug_health():
    return {
        "csv_path": str(CSV_PATH),
        "wide_rows": int(len(wide)),
        "long_rows": int(len(long)),
        "list_rows": int(len(long_for_lists)),
        "metrics_rows": int(len(metrics_df)),
        "unique_products_long": int(long_for_lists["product_clean"].nunique()),
        "unique_products_metrics": int(metrics_df["product_clean"].nunique()),
        "unique_fys_metrics": sorted(metrics_df["fy"].dropna().unique().tolist()),
        "nat_dates": int(long["date"].isna().sum()),
        "blank_fy_total": int((long["fy"].astype(str).str.strip() == "").sum()),
        "period_dtype": str(wide["Period"].dtype),
        "period_head": wide["Period"].head(10).tolist(),
        "forecast_type_unique": sorted(long_for_lists["forecast_type"].dropna().unique().tolist()),
        "method_columns_detected": method_cols[:30],
        "method_columns_count": int(len(method_cols)),
        "columns": wide.columns.tolist(),
    }


@app.get("/products", response_model=ListResponse)
def products():
    items = sorted(long_for_lists["product_clean"].unique().tolist())
    return cached_json({"items": items}, seconds=120)


@app.get("/fys/{product}", response_model=ListResponse)
def fys(product: str):
    p = product.strip().upper()
    sub = metrics_df[metrics_df["product_clean"] == p].copy()
    if sub.empty:
        return cached_json({"items": []}, seconds=120)

    years = sorted(sub["fy"].dropna().unique().tolist())
    return cached_json({"items": years}, seconds=120)


@app.get("/forecast-types", response_model=ListResponse)
def forecast_types():
    items = sorted(long_for_lists["forecast_type"].dropna().unique().tolist())
    return cached_json({"items": items}, seconds=120)


@app.get("/methods", response_model=ListResponse)
def methods():
    items = sorted(long_for_lists["method_clean"].unique().tolist())
    return cached_json({"items": items}, seconds=120)


@app.get("/compare/{product}", response_model=FyMethodComparisonResponse)
def compare_methods_for_fy(
    product: str,
    fy: str = Query(..., description="FY label e.g. FY23/24"),
    forecast_type: str = Query("Main", description="Main or Review"),
):
    sub = get_product_subset_metrics(product)
    sub = sub[(sub["fy"] == fy) & (sub["forecast_type"].str.lower() == forecast_type.strip().lower())].copy()
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"No metric-ready data for '{product}' in {fy} ({forecast_type})")

    rows: List[AccuracyRow] = []
    for method, g in sub.groupby("method_clean"):
        m = compute_metrics(g)
        rows.append(
            AccuracyRow(
                product_name=product.strip().upper(),
                fy=fy,
                forecast_type=forecast_type,
                method=method,
                bias=m["bias"],
                rmse=m["rmse"],
                mape=m["mape"],
                wape=m["wape"],
                n=m["n"],
                is_adopted=bool(g["is_adopted"].any()),
                is_ai=bool(g["is_ai"].any()),
            )
        )

    rows.sort(key=lambda r: (not r.is_adopted, (np.inf if np.isnan(r.wape) else r.wape), r.rmse))
    return {"product_name": product.strip().upper(), "fy": fy, "forecast_type": forecast_type, "rows": rows}


@app.get("/trend/{product}", response_model=TrendResponse)
def trend(
    product: str,
    forecast_type: str = Query("Main", description="Main or Review"),
    years: Optional[List[str]] = Query(default=None, description="Repeat ?years=FY23/24&years=FY24/25"),
):
    sub = get_product_subset_metrics(product)
    sub = sub[sub["forecast_type"].str.lower() == forecast_type.strip().lower()].copy()

    if not years:
        years = TARGET_FYS

    years_existing = [y for y in years if (sub["fy"] == y).any()]
    if not years_existing:
        raise HTTPException(status_code=404, detail=f"No data for '{product}' in requested years ({forecast_type})")

    points: List[TrendPoint] = []
    for fy in years_existing:
        fy_sub = sub[sub["fy"] == fy].copy()
        for method, g in fy_sub.groupby("method_clean"):
            m = compute_metrics(g)
            points.append(
                TrendPoint(
                    fy=fy,
                    forecast_type=forecast_type,
                    method=method,
                    rmse=m["rmse"],
                    mape=m["mape"],
                    wape=m["wape"],
                    bias=m["bias"],
                    n=m["n"],
                    is_adopted=bool(g["is_adopted"].any()),
                    is_ai=bool(g["is_ai"].any()),
                )
            )

    fy_order = {y: i for i, y in enumerate(years_existing)}
    points.sort(key=lambda p: (fy_order.get(p.fy, 999), not p.is_adopted, (np.inf if np.isnan(p.wape) else p.wape)))

    return {
        "product_name": product.strip().upper(),
        "years": years_existing,
        "forecast_type": forecast_type,
        "points": points,
    }


@app.get("/actuals/{product}", response_model=HistoricalData)
def actuals(product: str, fy: str = Query(..., description="FY label e.g. FY23/24")):
    p = product.strip().upper()
    sub = metrics_df[(metrics_df["product_clean"] == p) & (metrics_df["fy"] == fy)].copy()
    if sub.empty:
        raise HTTPException(status_code=404, detail=f"No actuals for '{product}' in {fy}")

    # distinct monthly actuals (metrics_df still repeats across methods, so dedupe by date)
    sub = sub.dropna(subset=["actual_num", "date"]).drop_duplicates(subset=["date"]).sort_values("date")

    actuals_list = sub["actual_num"].astype(float).tolist()
    if not actuals_list:
        raise HTTPException(status_code=404, detail=f"No numeric actuals for '{product}' in {fy}")

    return {"product_name": p, "fy": fy, "actuals": actuals_list}
