# main.py
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

import pandas as pd
import numpy as np
from pathlib import Path


# -----------------------------------------------------------------------------
# Create app + CORS
# -----------------------------------------------------------------------------
app = FastAPI(title="Forecast Accuracy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # during development; you can restrict to localhost:5173 later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Load and prepare data
# -----------------------------------------------------------------------------
DATA_PATH = Path(__file__).parent / "test data.csv"

df_all = pd.read_csv(DATA_PATH)

# Parse dates and financial year
df_all["period"] = pd.to_datetime(df_all["period"], dayfirst=True, errors="coerce")
df_all["fy"] = df_all["period"].dt.year

# Clean method names
df_all["Adopted Method"] = (
    df_all["Adopted Method"]
    .astype(str)
    .str.strip()
    .replace({"Consumption ": "Consumption"})
)

# Only use AI era (2023+) for evaluation
df_eval = df_all[df_all["fy"] >= 2023].copy()

# If LMIS should only be recognised from 2025 onwards, treat earlier LMIS as Consumption
df_eval.loc[df_eval["fy"] < 2025, "Adopted Method"] = (
    df_eval.loc[df_eval["fy"] < 2025, "Adopted Method"]
    .replace({"Consumption LMIS": "Consumption"})
)

# Precompute numeric versions of Actual and Forecast
def _to_number(series: pd.Series) -> pd.Series:
    """Convert strings like '132,830' to float."""
    return (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .replace("nan", np.nan)
        .astype(float)
    )


df_eval["Actual_val"] = _to_number(df_eval["Actual Consumption"])
df_eval["Forecast_val"] = _to_number(df_eval["Forecast"])

# Drop rows without usable numbers
df_eval = df_eval.dropna(subset=["Actual_val", "Forecast_val", "fy"])


# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------
class ListResponse(BaseModel):
    items: List[str]


class HistoricalData(BaseModel):
    product_name: str
    fy: int
    actuals: List[float]


class AdoptedAccuracyResponse(BaseModel):
    product_name: str
    fy: int
    adopted_method: str
    bias: float
    rmse: float
    mape: float
    count: int


# -----------------------------------------------------------------------------
# Helper: compute metrics
# -----------------------------------------------------------------------------
def compute_metrics_for_slice(df_slice: pd.DataFrame) -> tuple[float, float, float, int]:
    """
    Compute Bias, RMSE, MAPE and N for a slice with columns Actual_val, Forecast_val.
    """
    if df_slice.empty:
        return float("nan"), float("nan"), float("nan"), 0

    err = df_slice["Forecast_val"] - df_slice["Actual_val"]

    bias = float(err.mean())
    rmse = float(np.sqrt((err ** 2).mean()))
    # prevent division by zero in MAPE
    non_zero = df_slice["Actual_val"] != 0
    if non_zero.any():
        mape = float((err.abs()[non_zero] / df_slice["Actual_val"][non_zero]).mean() * 100.0)
    else:
        mape = float("nan")

    count = int(len(df_slice))
    return bias, rmse, mape, count


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/products", response_model=ListResponse)
def list_products() -> ListResponse:
    """List products that have evaluation data (FY >= 2023)."""
    products = sorted(df_eval["product_name"].dropna().unique().tolist())
    return ListResponse(items=products)


@app.get("/methods", response_model=ListResponse)
def list_methods() -> ListResponse:
    """List distinct (cleaned) adopted methods in the dataset."""
    methods = (
        df_eval["Adopted Method"]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
        .tolist()
    )
    methods = sorted(methods)
    return ListResponse(items=methods)


@app.get("/years/{product}", response_model=ListResponse)
def list_years_for_product(product: str) -> ListResponse:
    """
    List financial years that have data for the given product (FY >= 2023).
    Returned as strings so the frontend can bind directly to a <select>.
    """
    mask = df_eval["product_name"] == product
    years = (
        df_eval.loc[mask, "fy"]
        .dropna()
        .astype(int)
        .sort_values()
        .unique()
        .tolist()
    )
    if not years:
        raise HTTPException(status_code=404, detail=f"No data for product '{product}'.")
    return ListResponse(items=[str(y) for y in years])


@app.get("/fy_adopted_accuracy/{product}/{fy}", response_model=AdoptedAccuracyResponse)
def fy_adopted_accuracy(product: str, fy: int) -> AdoptedAccuracyResponse:
    """
    Forecast accuracy for the adopted method, for a given product and financial year.
    This is a single-row summary: one method per product+FY.
    """
    mask = (df_eval["product_name"] == product) & (df_eval["fy"] == fy)
    subset = df_eval.loc[mask].copy()

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for product '{product}' in FY {fy}.",
        )

    # Clean method name again just in case
    subset["Adopted Method"] = (
        subset["Adopted Method"].astype(str).str.strip().replace({"Consumption ": "Consumption"})
    )

    # Most frequent method in that FY is treated as the adopted method
    adopted_method = subset["Adopted Method"].mode().iat[0]

    bias, rmse, mape, count = compute_metrics_for_slice(subset)

    if count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No usable forecast/actual data for '{product}' in FY {fy}.",
        )

    return AdoptedAccuracyResponse(
        product_name=product,
        fy=fy,
        adopted_method=adopted_method,
        bias=bias,
        rmse=rmse,
        mape=mape,
        count=count,
    )


@app.get("/data/actuals/{product}/{fy}", response_model=HistoricalData)
def actuals_for_histogram(product: str, fy: int) -> HistoricalData:
    """
    Actual consumption values for histogram, for a given product and FY.
    """
    mask = (df_eval["product_name"] == product) & (df_eval["fy"] == fy)
    subset = df_eval.loc[mask, ["Actual_val"]].dropna()

    if subset.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No actuals found for product '{product}' in FY {fy}.",
        )

    return HistoricalData(
        product_name=product,
        fy=fy,
        actuals=subset["Actual_val"].astype(float).tolist(),
    )
