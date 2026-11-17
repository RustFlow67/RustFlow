/**
 * Flagship Liquid Glass backdrop: wallpaper + mesh aurora + volumetric
 * god rays + drifting bloom orbs + refractive glass layers + film grain.
 * Layer count is driven by the FPS lab (data-lab-layers 0–6).
 */
export default function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div id="backdrop-parallax" className="backdrop-parallax">
        <div className="backdrop-img" />
      </div>
      <div className="backdrop-aurora" />
      <div className="rf-aurora-plus" />
      <div className="rf-aurora-plus rf-aurora-plus-b" />
      <div className="rf-caustic-field" />
      <div className="rf-parallax-layer" data-rf-parallax="0.06" />
      <div className="rf-parallax-layer rf-parallax-layer-b" data-rf-parallax="0.12" />
      <div className="backdrop-rays" />
      <div className="backdrop-orb orb-a" />
      <div className="backdrop-orb orb-b" />
      <div className="backdrop-orb orb-c" />
      <div className="backdrop-glass-layers">
        <div className="glass-layer" />
        <div className="glass-layer" />
        <div className="glass-layer" />
        <div className="glass-layer" />
        <div className="glass-layer" />
        <div className="glass-layer" />
      </div>
      <div className="stress-storm" />
      <div className="backdrop-grain" />
      <div className="backdrop-shade" />
    </div>
  );
}
