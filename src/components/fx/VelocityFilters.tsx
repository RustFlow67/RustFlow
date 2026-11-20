/** Resource definitions only. Never attach a filter to the page root or fixed chrome. */
export default function VelocityFilters() {
  const region = { x: "-50%", y: "-40%", width: "200%", height: "180%", colorInterpolationFilters: "sRGB" } as const;
  return <svg className="velocity-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id="motion-blur-x" {...region}><feGaussianBlur stdDeviation="20, 0" /></filter>
      <filter id="motion-blur-y" {...region}><feGaussianBlur stdDeviation="0, 16" /></filter>
    </defs>
  </svg>;
}
