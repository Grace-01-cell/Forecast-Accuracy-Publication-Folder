import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface HistogramChartProps {
  actuals: number[];
  productName: string;
}

const HistogramChart: React.FC<HistogramChartProps> = ({ actuals, productName }) => {
  // your createHistogramData(actuals) here
  // const histogramData = createHistogramData(actuals);

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={/* histogramData */ []} margin={{ top: 10, right: 10, left: 10, bottom: 50 }}>
          {/* axes, tooltip, bar etc */}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistogramChart;
