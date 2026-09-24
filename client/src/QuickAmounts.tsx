import "./styles/quick-amounts.css";

const PRESETS = [10, 50, 100];

/** One-tap bet amounts under the points input: fixed presets plus all-in. */
export function QuickAmounts({
  balance,
  amount,
  onPick,
}: {
  balance: number;
  amount: string;
  onPick: (amount: string) => void;
}) {
  const options = [
    ...PRESETS.map((value) => ({ label: String(value), value })),
    { label: "All-in", value: balance },
  ];
  return (
    <div className="quick-amounts" role="group" aria-label="Quick amounts">
      {options.map(({ label, value }) => (
        <button
          key={label}
          type="button"
          className="chip"
          disabled={value <= 0 || value > balance}
          aria-pressed={amount === String(value)}
          onClick={() => onPick(String(value))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
