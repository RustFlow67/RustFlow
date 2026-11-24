export default function DesktopHome() {
  return <div style={{padding:'80px clamp(24px,10vw,160px)',color:'#f5f5f7'}}><p>SHIFT / WINDOWS</p><h1 style={{fontSize:'clamp(3rem,8vw,8rem)',margin:'24px 0'}}>Ваша система.</h1><p>Выберите инструмент.</p><nav style={{display:'flex',gap:24,marginTop:32}}><a href="/benchmark/">Сборка ↗</a><a href="/presets/">Пресеты ↗</a><a href="/tweaker/">Твикер ↗</a></nav></div>;
}
