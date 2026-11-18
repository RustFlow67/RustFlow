/** Paint the final value once; changing the key restarts a CSS fade, not a per-frame text rewrite. */
export function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const display = value.toFixed(digits);
  return <span key={display} className="rf-result-value">{display}</span>;
}
