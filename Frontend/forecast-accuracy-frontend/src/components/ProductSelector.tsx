// src/components/ProductSelector.tsx
import React from "react";

interface ProductSelectorProps {
  products: string[];
  selectedProduct: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  selectedProduct,
  onChange,
  loading,
}) => {
  return (
    <div className="control-group">
      <label className="control-label">1. Select Product</label>

      <select
        className="control-select"
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
