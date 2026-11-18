export default function Backdrop() {
  return <div className="wallpaper-scene" aria-hidden="true">
    <span className="ambient-glow" />
    {[1, 2, 3, 4].map((index) => (
      <span key={index} className={`wallpaper-parallax blob-${index}`}>
        <span className="glass-blob" />
      </span>
    ))}
  </div>;
}
