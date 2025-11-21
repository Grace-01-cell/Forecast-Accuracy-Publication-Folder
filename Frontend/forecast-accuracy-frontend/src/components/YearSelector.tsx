// src/components/YearSelector.tsx
import React from "react";

interface YearSelectorProps {
  years: string[];
  selectedYear: string;
  onChange: (value: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  years,
  selectedYear,
  onChange,
  loading,
  disabled,
}) => {
  return (
    <div className="control-group">
      <label className="control-label">2. Select Financial Year</label>

      <select
        className="control-select"
        value={selectedYear}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? "Loading financial years..." : "Choose a financial year"}
        </option>

        {years.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
    </div>
  );
};

export default YearSelector;
