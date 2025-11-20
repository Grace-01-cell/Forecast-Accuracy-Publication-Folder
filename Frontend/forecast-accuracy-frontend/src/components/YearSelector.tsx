// src/components/YearSelector.tsx
import React from "react";

interface YearSelectorProps {
  years: string[];
  selectedYear: string;
  onChange: (value: string) => void;
  loading: boolean;
  disabled: boolean;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  years,
  selectedYear,
  onChange,
  loading,
  disabled,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-semibold text-slate-800 mb-3">
        2. Select Financial Year
      </h2>
      <select
        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        value={selectedYear}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || disabled || years.length === 0}
      >
        <option value="">
          {loading
            ? "Loading years..."
            : years.length === 0
            ? "No years available"
            : "Choose a financial year"}
        </option>
        {years.map((y) => (
          <option key={y} value={y}>
            FY {y}
          </option>
        ))}
      </select>
      {years.length > 0 && !loading && (
        <p className="mt-2 text-xs text-slate-500">
          Showing data from FY {years[0]} onwards (AI era).
        </p>
      )}
    </div>
  );
};

export default YearSelector;
