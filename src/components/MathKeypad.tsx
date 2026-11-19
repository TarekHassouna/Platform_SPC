"use client";

interface MathKeypadProps {
  onInsert: (token: string) => void;
  disabled?: boolean;
}

const KEYS = [
  { label: "×", token: " * " },
  { label: "/", token: "/" },
  { label: "( )", token: "()" },
  { label: "x²", token: "^2" },
  { label: "×10⁻³", token: "e-3" },
  { label: "×10³", token: "e3" },
  { label: "A", token: " A" },
  { label: "mA", token: " mA" },
  { label: "V", token: " V" },
  { label: "Ω", token: " Ω" },
  { label: "kg", token: " kg" },
  { label: "m/s", token: " m/s" },
  { label: "mol/L", token: " mol/L" },
  { label: "ms", token: " ms" },
];

export function MathKeypad({ onInsert, disabled }: MathKeypadProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {KEYS.map((k) => (
        <button
          key={k.label}
          type="button"
          disabled={disabled}
          onClick={() => onInsert(k.token)}
          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-700 text-xs font-mono font-bold transition-colors disabled:opacity-40"
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
