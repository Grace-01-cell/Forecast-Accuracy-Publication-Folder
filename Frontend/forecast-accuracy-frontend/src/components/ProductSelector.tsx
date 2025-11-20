// src/components/ProductSelector.tsx
import React from "react";

interface ProductSelectorProps {
  products: string[];
  selectedProduct: string;
  onChange: (value: string) => void;
  loading: boolean;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProduct,
  onChange,
  loading,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <h2 className="text-xl font-semibold text-slate-800 mb-3">
        1. Select Product
      </h2>
      <select
        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        value={selectedProduct}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">
          {loading ? "Loading products..." : "Choose a product"}
        </option>
        {products.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ProductSelector;
