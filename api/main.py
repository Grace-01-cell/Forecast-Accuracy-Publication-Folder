from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
import numpy as np
import os

# --------------------------------------------------------------------
# 1. Load and prepare data
# --------------------------------------------------------------------

CSV_PATH = "test data.csv"  # change if needed

if not os.path.exists(CSV_PATH):
    raise RuntimeError(f"CSV file not found at {CSV_PATH}")

df = pd.read_csv(CSV_PATH)

# Expected columns:
# - product_name
# - period (e.g. "01/07/2023")
# - Actual Consumption
# - Forecast
# - Adopted Method

df["date"] = pd.to_datetime(df["period"], dayfirst=True, errors="coerce")
if df["date"].isna().any():
    raise RuntimeError("Some dates could not be parsed from 'period' column.")

for col in ["Actual Consumption", "Forecast"]:
    df[col + "_num"] = pd.to_numeric(
        df[col].astype(str).str.replace(",", ""),
        errors="coerce",
    )

df["Adopted Method_clean"] = df["Adopted Method"].astype(str).str.strip()


def fy_label(dt: pd.Timestamp) -> str:
    year = dt.year
    month = dt.month
    start_year = year if month >= 7 else year - 1
    return f"FY{start_year % 100:02d}/{(start_year + 1) % 100:02d}"


def fy_start_year(dt: pd.Timestamp) -> int:
    year = dt.year
    month = dt.month
    return year if month >= 7 else year - 1


df["fy_label"] = df["date"].apply(fy_label)
df["fy_start_year"] = df["date"].apply(fy_start_year)

# --------------------------------------------------------------------
# 2. Pydantic models
# --------------------------------------------------------------------


class ListResponse(BaseModel):
    items: List[str]


class AdoptedAccuracyResponse(BaseModel):
    product_name: str
    fy: str
    adopted_method: str
    bias: float
    rmse: float
    mape: float
    count: int


class HistoricalData(BaseModel):
    product_name: str
    fy: str
    actuals: List[float]


class YearAccuracy(BaseModel):
    fy: str
    adopted_method: str
    bias: float
    rmse: float
    mape: float
    count: int


class ThreeYearAccuracyResponse(BaseModel):
    product_name: str
    years: List[YearAccuracy]


# --------------------------------------------------------------------
# 3. FastAPI app + CORS
# --------------------------------------------------------------------

app = FastAPI(title="Forecast Accuracy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------
# 4. Utility: compute accuracy for adopted method in a FY
# --------------------------------------------------------------------


def compute_adopted_accuracy(product: str, fy: str) -> AdoptedAccuracyResponse:
    subset = df[
        (df["product_name"] == product) & (df["fy_label"] == fy)
    ].copy()

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for product '{product}' in {fy}.",
        )

    subset = subset.dropna(subset=["Actual Consumption_num", "Forecast_num"])
    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No usable actual/forecast pairs for '{product}' in {fy}.",
        )

    method_counts = subset["Adopted Method_clean"].value_counts()
    adopted_method = method_counts.idxmax()

    subset_method = subset[subset["Adopted Method_clean"] == adopted_method]
    if subset_method.empty:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No data for adopted method '{adopted_method}' "
                f"for '{product}' in {fy}."
            ),
        )

    actual = subset_method["Actual Consumption_num"].to_numpy()
    forecast = subset_method["Forecast_num"].to_numpy()
    errors = forecast - actual

    bias = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    mape = float(
        np.mean(np.abs(errors) / np.where(actual == 0, np.nan, actual)) * 100.0
    )
    count = int(len(subset_method))

    return AdoptedAccuracyResponse(
        product_name=product,
        fy=fy,
        adopted_method=adopted_method,
        bias=bias,
        rmse=rmse,
        mape=mape,
        count=count,
    )


# --------------------------------------------------------------------
# 5. Endpoints
# --------------------------------------------------------------------


@app.get("/products", response_model=ListResponse)
def get_products():
    products = sorted(df["product_name"].dropna().unique().tolist())
    return ListResponse(items=products)


@app.get("/years/{product}", response_model=ListResponse)
def get_years_for_product(product: str):
    subset = df[df["product_name"] == product]
    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for product '{product}'.",
        )

    subset = subset[subset["fy_start_year"] >= 2023]
    years = sorted(subset["fy_label"].dropna().unique().tolist())

    if not years:
        raise HTTPException(
            status_code=404,
            detail=f"No financial years from FY23/24 onwards for '{product}'.",
        )

    return ListResponse(items=years)


@app.get("/fy_adopted_accuracy/{product}", response_model=AdoptedAccuracyResponse)
def get_fy_adopted_accuracy(
    product: str,
    fy_label: str = Query(..., description="Fiscal year label, e.g. FY23/24"),
):
    return compute_adopted_accuracy(product, fy_label)


@app.get("/data/actuals/{product}", response_model=HistoricalData)
def get_actuals_for_product_fy(
    product: str,
    fy_label: str = Query(..., description="Fiscal year label, e.g. FY23/24"),
):
    subset = df[
        (df["product_name"] == product) & (df["fy_label"] == fy_label)
    ].copy()

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No actual consumption data for '{product}' in {fy_label}.",
        )

    subset = subset.sort_values("date")
    actuals = subset["Actual Consumption_num"].dropna().tolist()
    if not actuals:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No numeric actual consumption values for "
                f"'{product}' in {fy_label}."
            ),
        )

    return HistoricalData(product_name=product, fy=fy_label, actuals=actuals)


@app.get("/fy_accuracy_3year/{product}", response_model=ThreeYearAccuracyResponse)
def get_three_year_accuracy(product: str):
    """
    Returns accuracy for up to 3 fixed fiscal years:
      FY23/24, FY24/25, FY25/26
    Only includes years that actually exist for that product.
    """
    target_years = ["FY23/24", "FY24/25", "FY25/26"]
    results: List[YearAccuracy] = []

    for fy in target_years:
        subset = df[
            (df["product_name"] == product) & (df["fy_label"] == fy)
        ]
        if subset.empty:
            continue

        acc = compute_adopted_accuracy(product, fy)
        results.append(
            YearAccuracy(
                fy=acc.fy,
                adopted_method=acc.adopted_method,
                bias=acc.bias,
                rmse=acc.rmse,
                mape=acc.mape,
                count=acc.count,
            )
        )

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No data available for {product} in FY23/24–FY25/26.",
        )

    return ThreeYearAccuracyResponse(product_name=product, years=results)
