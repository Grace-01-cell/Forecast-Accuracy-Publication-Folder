// src/components/MethodSelector.tsx
import React from "react";

interface MethodSelectorProps {
  methods: string[];
  selectedMethods: string[];
  onChange: (method: string, checked: boolean) => void;
  loading: boolean;
  disabled: boolean;
}

const MethodSelector: React.FC<MethodSelectorProps> = ({
  methods,
  selectedMethods,
  onChange,
  loading,
  disabled,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-800">
          2. Select Method(s) for Comparison
        </h2>
        {loading && (
          <span className="text-xs text-slate-400">Loading methods…</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {methods.map((method) => (
          <label
            key={method}
            className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer"
          >
            <input
              type="checkbox"
              className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              checked={selectedMethods.includes(method)}
              onChange={(e) => onChange(method, e.target.checked)}
              disabled={disabled}
            />
            <span>{method}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default MethodSelector;
