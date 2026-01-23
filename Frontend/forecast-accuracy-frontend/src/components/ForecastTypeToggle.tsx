type Props = {
  value: string;                 // "Main" | "Reviewed"
  onChange: (v: string) => void;
  show: boolean;                 // hide when review not available
};

export default function ForecastTypeToggle({ value, onChange, show }: Props) {
  if (!show) return null;

  const base =
    "px-3 py-2 rounded-lg text-sm font-medium border transition";
  const active = "bg-white text-slate-900";
  const inactive = "bg-transparent text-white/80 hover:text-white";

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/80 text-sm">Forecast Type</span>
      <div className="inline-flex rounded-xl border border-white/20 p-1">
        <button
          className={`${base} ${value === "Main" ? active : inactive}`}
          onClick={() => onChange("Main")}
          type="button"
        >
          Main
        </button>
        <button
          className={`${base} ${value === "Review" ? active : inactive}`}
          onClick={() => onChange("Review")}
          type="button"
        >
          Review
        </button>
      </div>
    </div>
  );
}
