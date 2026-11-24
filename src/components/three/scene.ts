import * as THREE from 'three';
import { createSetupSculptures } from './setupSculptures';

export type SceneKind = 'sculpture' | 'core' | 'balance' | 'wave' | 'cinematic';
export type SceneState = { step?: number; goal?: 'fps' | 'smooth' | 'balanced'; accepted?: boolean; values?: number[]; chapter?: number; progress?: number; profile?: number; selected?: number; homeScene?: number };

/** One bounded renderer per visible scene; no network textures or animation framework. */
export function createScene(canvas: HTMLCanvasElement, kind: SceneKind, initial: SceneState) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const software = debug && /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
  renderer.setPixelRatio(software ? .35 : Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const backgroundScene = new THREE.Scene();
  const backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let backgroundMaterial: THREE.ShaderMaterial | undefined;
  let themeMix = 0;
  const landscape = new THREE.Scene();
  const landscapeCamera = new THREE.PerspectiveCamera(53, 1, .1, 110);
  landscapeCamera.position.set(0, 3.5, 9); landscapeCamera.lookAt(0, -1.4, -15);
  let landscapeMaterial: THREE.ShaderMaterial | undefined;

  if (kind === 'cinematic') scene.fog = new THREE.FogExp2(0x050505, .045);
  const camera = new THREE.PerspectiveCamera(kind === 'wave' ? 55 : 38, 1, .1, 100);
  camera.position.set(0, kind === 'balance' ? 3.3 : 0, kind === 'balance' ? 10 : kind === 'wave' ? 12 : 8.2);
  if (kind === 'balance') camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x343438, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.4); key.position.set(-4, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 3); rim.position.set(5, -1, -4); scene.add(rim);
  const root = new THREE.Group(); scene.add(root);
  const resources: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T) => { resources.push(resource); return resource; };
  // A generated studio lightbox gives metal a real PBR environment without external assets.
  const environment = document.createElement('canvas'); environment.width = 512; environment.height = 256;
  const ctx = environment.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#151517'; ctx.fillRect(0, 0, 512, 256);
    const lights: [number, number, number, number, string][] = [[24, 20, 56, 175, '#e9e9e9'], [135, 35, 16, 165, '#a0a0a0'], [220, 5, 110, 35, '#fff'], [370, 24, 36, 180, '#d8d8d8'], [456, 55, 20, 125, '#a3a3a3']];
    lights.forEach(([x, y, w, h, color]) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); });
    const env = track(new THREE.CanvasTexture(environment)); env.mapping = THREE.EquirectangularReflectionMapping; env.colorSpace = THREE.SRGBColorSpace; scene.environment = env;
  }
  if (kind === 'cinematic') {
    backgroundMaterial = track(new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { theme: { value: 0 }, clock: { value: 0 }, glitch: {value:0} },
      vertexShader: `void main(){gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `uniform float theme; uniform float clock; uniform float glitch;
        float b2(vec2 p){return p.y<1. ? (p.x<1. ? 0. : 2.) : (p.x<1. ? 3. : 1.);}
        float b8(vec2 p){return b2(mod(p,2.))*16.+b2(mod(floor(p/2.),2.))*4.+b2(mod(floor(p/4.),2.));}
        void main(){vec2 p=floor(gl_FragCoord.xy); float d=(b8(mod(p,8.))+.5)/64.-.5;
          float shade=mix(.027,.886,theme); float grain=(d*.014)*(0.25+theme*.75);
          float glow=.012*sin(p.x*.003+clock*.12)*sin(p.y*.004-clock*.09); glow += glitch * .025 * step(.985,fract(p.y*.03));
          vec3 base=mix(vec3(shade),vec3(shade,shade*.993,shade*.972),theme);
          gl_FragColor=vec4(clamp(base+grain+glow,0.,1.),1.);}` }));
    backgroundScene.add(new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)), backgroundMaterial));
    renderer.autoClear = false;
    // One GPU-displaced grid, drawn behind the sculpture with perspective and
    // depth fade. Geometry is static; only shader uniforms change per frame.
    const vertices: number[] = [];
    const cols = software ? 90 : 156, rows = software ? 75 : 130;
    for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) vertices.push((x / (cols - 1) - .5) * 48, 0, 7 - z / (rows - 1) * 65);
    const grid = track(new THREE.BufferGeometry()); grid.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    landscapeMaterial = track(new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ clock:{value:0}, light:{value:0}, pixelRatio:{value:renderer.getPixelRatio()} },
      vertexShader:`uniform float clock; uniform float pixelRatio; varying float fade; void main(){vec3 p=position; p.y=-2.0 + sin(p.x*.42+clock*.46)*.58 + cos(p.z*.31-clock*.34)*.42 + sin(p.x*.18+p.z*.2+clock*.22)*.65; vec4 mv=modelViewMatrix*vec4(p,1.); fade=clamp(1.0-(-mv.z-5.0)/58.0,0.0,1.0); gl_PointSize=clamp((30.0 / -mv.z)*pixelRatio, 1.1, 3.8); gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform float light; varying float fade; void main(){float d=length(gl_PointCoord-.5); float dotAlpha=1.0-smoothstep(.27,.5,d); gl_FragColor=vec4(mix(vec3(.80,.80,.83),vec3(.08),light),dotAlpha*fade*mix(.82,.20,light));}` }));
    landscape.add(new THREE.Points(grid, landscapeMaterial)); canvas.dataset.wave = 'perspective';
  }
  const metal = track(new THREE.MeshStandardMaterial({ color: 0xbcbcbc, metalness: .96, roughness: .22 }));
  const graphite = track(new THREE.MeshStandardMaterial({ color: 0x242428, metalness: .68, roughness: .42 }));
  const lightMetal = track(new THREE.MeshStandardMaterial({ color: 0xe7e7e7, metalness: .82, roughness: .29 }));
  const rings: THREE.Mesh[] = [];
  let core: THREE.Mesh | undefined;
  const bars: THREE.Mesh[] = [];
  let wave: THREE.Points | undefined;
  const forms: THREE.Group[] = [];
  const ringGroup = new THREE.Group();
  if (kind === 'cinematic' || kind === 'core') root.add(ringGroup);
  let setupSculptures: ReturnType<typeof createSetupSculptures> | undefined;

  if (kind === 'sculpture' || kind === 'core' || kind === 'cinematic') {
    const count = kind === 'core' ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const radius = 1.32 + (i % 3) * .23;
      const mesh = new THREE.Mesh(track(new THREE.TorusGeometry(radius, i === 0 ? .15 : .055 + (i % 2) * .025, (software ? 10 : 18), (software ? 72 : 144))), i % 2 ? metal : graphite);
      mesh.rotation.set(.5 + i * .56, .35 + i * .41, i * .63);
      (kind === "cinematic" || kind === "core" ? ringGroup : root).add(mesh); rings.push(mesh);
    }
    // Faceted, finely ribbed core with independently moving orbits.
    core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(kind === 'core' ? .85 : .72, software ? 2 : 3)), kind === 'core' ? lightMetal : metal);
    (kind === "cinematic" || kind === "core" ? ringGroup : root).add(core);
    const wire = new THREE.Mesh(track(new THREE.IcosahedronGeometry(kind === 'core' ? .89 : .76, 2)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .13 })));
    core.add(wire);
    const positions: number[] = [];
    const particleCount = software ? 220 : 420;
    for (let i = 0; i < particleCount; i++) {
      const a = i * 2.399963, y = 1 - (i / (particleCount - 1)) * 2, r = Math.sqrt(1 - y * y), d = 2 + (i % 9) * .05;
      positions.push(Math.cos(a) * r * d, y * d, Math.sin(a) * r * d);
    }
    const particles = track(new THREE.BufferGeometry()); particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    root.add(new THREE.Points(particles, track(new THREE.PointsMaterial({ color: 0xffffff, size: .025, transparent: true, opacity: .38 }))));
    if (kind === 'core') setupSculptures = createSetupSculptures(root, ringGroup, lightMetal, graphite, track, Boolean(software));
    if (kind === 'cinematic') {
      forms.push(ringGroup);
      const prism = new THREE.Group();
      const prismMaterial = track(new THREE.MeshPhysicalMaterial({ color: 0x777777, metalness: .15, roughness: .12, transmission: software ? 0 : .65, thickness: 1.0, ior: 1.4, clearcoat: 1 }));
      const prismGeo = track(new THREE.OctahedronGeometry(2.1, 0));
      prism.add(new THREE.Mesh(prismGeo, prismMaterial));
      prism.add(new THREE.Mesh(prismGeo, track(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .2 }))));
      root.add(prism); forms.push(prism);
      const monolith = new THREE.Group();
      const slab = track(new THREE.BoxGeometry(2.4, .22, 1.4));
      for (let i = 0; i < 7; i++) { const mesh = new THREE.Mesh(slab, i % 2 ? metal : graphite); mesh.position.y = (i - 3) * .29; monolith.add(mesh); }
      root.add(monolith); forms.push(monolith);
      const fan = new THREE.Group();
      const outer = new THREE.Mesh(track(new THREE.TorusGeometry(1.55, .12, 14, 100)), metal); fan.add(outer);
      const blade = track(new THREE.BoxGeometry(.35, 1.28, .13));
      for (let i = 0; i < 7; i++) { const mesh = new THREE.Mesh(blade, graphite); const angle = i * Math.PI * 2 / 7; mesh.position.set(Math.sin(angle) * .75, Math.cos(angle) * .75, 0); mesh.rotation.z = -angle + .4; fan.add(mesh); }
      fan.add(new THREE.Mesh(track(new THREE.SphereGeometry(.35, 24, 16)), metal)); root.add(fan); forms.push(fan);
      const sphere = new THREE.Group(); sphere.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.75, software ? 2 : 3)), graphite));
      sphere.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.77, 1)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .12 })))); root.add(sphere); forms.push(sphere);
      const obsidian = track(new THREE.MeshStandardMaterial({color:0x141416,metalness:.25,roughness:.46}));
      const architecture = new THREE.Group();
      const archGeo = track(new THREE.OctahedronGeometry(1.35,0));
      const prismA = new THREE.Mesh(archGeo,obsidian); prismA.scale.set(.78,1.55,.7); prismA.position.x=-.58; prismA.rotation.z=.18;
      const prismB = new THREE.Mesh(archGeo,obsidian); prismB.scale.set(.7,1.1,.65); prismB.position.set(.7,-.25,-.3); prismB.rotation.z=-.2;
      const prismC = new THREE.Mesh(archGeo,graphite); prismC.scale.set(.32,.78,.4); prismC.position.set(1.35,.6,.1); prismC.rotation.z=.24;
      const shard = new THREE.Mesh(archGeo,obsidian); shard.scale.set(.22,.68,.25); shard.position.set(-1.35,-.45,.2); shard.rotation.z=-.3;
      architecture.add(prismA,prismB,prismC,shard); root.add(architecture); forms.push(architecture);
      const geodesic = new THREE.Group(); const geoShape=track(new THREE.IcosahedronGeometry(1.6,software?1:2));
      geodesic.add(new THREE.Mesh(geoShape,obsidian));
      for (let i=0;i<5;i++) { const shard = new THREE.Mesh(archGeo, i%2 ? graphite : obsidian); const a=i*Math.PI*2/5; shard.position.set(Math.cos(a)*1.35,Math.sin(a)*1.25,-.2); shard.rotation.z=a; shard.scale.set(.18,.45,.23); geodesic.add(shard); }
      geodesic.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.61,1)),track(new THREE.MeshBasicMaterial({color:0x999999,wireframe:true,transparent:true,opacity:.32}))));
      root.add(geodesic); forms.push(geodesic);
      const silverCore = new THREE.Group(); silverCore.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.65,software?1:2)),lightMetal));
      silverCore.add(new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.66,1)),track(new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:.2}))));
      root.add(silverCore); forms.push(silverCore);
      forms.forEach((form, i) => form.scale.setScalar(i ? .001 : 1));
    }
  } else if (kind === 'balance') {
    const floor = new THREE.Mesh(track(new THREE.BoxGeometry(6.5, .1, 2.5)), graphite); floor.position.y = -.08; root.add(floor);
    const grid = new THREE.GridHelper(6.5, 13, 0x777777, 0x393939); grid.position.y = -.02; root.add(grid);
    grid.geometry && resources.push(grid.geometry); (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => resources.push(m));
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(track(new THREE.BoxGeometry(.65, 1, .65, 1, 1, 1)), i % 2 ? metal : lightMetal);
      bar.position.x = (i - 2) * 1.2; root.add(bar); bars.push(bar);
    }
    root.rotation.y = -.34;
  } else {
    const vertices: number[] = [];
    for (let z = 0; z < 36; z++) for (let x = 0; x < 60; x++) vertices.push((x - 29.5) * .34, -1.6, (z - 18) * .36);

    const geometry = track(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    const material = track(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 } }, vertexShader: `uniform float time; varying float depth; void main(){vec3 pos=position; pos.y += sin(pos.x*.55+pos.z*.8-time*.65)*.35+cos(pos.x*.3-pos.z*.5+time*.3)*.2; vec4 p=modelViewMatrix*vec4(pos,1.); depth=clamp((-p.z-3.)/19.,0.,1.); gl_PointSize=clamp(34./-p.z,1.,5.); gl_Position=projectionMatrix*p;}`, fragmentShader: `varying float depth; void main(){float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.12,d)*(1.-depth)*.65; gl_FragColor=vec4(vec3(.86),a);}` }));
    wave = new THREE.Points(geometry, material); root.add(wave); camera.position.set(0, 3.4, 9); camera.lookAt(0, -1, -3);
  }
  let state = initial, frame = 0, alive = true, visible = true, dragging = false;
  let lastPaint = 0, glitchStrength = 0;
  let x = 0, y = 0, lastX = 0, lastY = 0, vx = 0, vy = 0, pointerX = 0, pointerY = 0, impulse = 0, time = 0, previous = 0;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.documentElement.dataset.motion === 'reduced';
  function render(now: number) {
    frame = 0;
    if (!alive || !visible || document.hidden || canvas.closest('[inert]') || ((kind === 'wave' || kind === 'cinematic') && document.documentElement.hasAttribute('data-onboarding'))) return;
    if (software && kind === 'wave' && !reduced() && now - lastPaint < 45) { frame = requestAnimationFrame(render); return; }
    lastPaint = now;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
    if (!reduced()) {
      time += dt;
      if (!dragging) { x += vx; y = THREE.MathUtils.clamp(y + vy, -1.1, 1.1); vx *= .94; vy *= .94; }
      impulse *= .95;
    }
    if (kind === 'sculpture' || kind === 'core' || kind === 'cinematic') {
      const phase = state.step ?? 0;
      if (kind === 'core') setupSculptures?.update(state, dt, time, reduced(), canvas);
      if (kind === 'cinematic') {
        const chapter = state.chapter ?? 0;
        const home = state.homeScene;
        const selected = home === undefined ? (chapter < 3 ? 0 : chapter - 2) : [0, 5, 6, 7][home] ?? 0;
        const damping = reduced() ? 1 : Math.min(1, dt * 2.8);
        forms.forEach((form, i) => { const target = i === selected ? (home === 1 ? (camera.aspect < 1 ? .40 : .82) : home === 2 ? (camera.aspect < 1 ? .43 : .90) : home === 0 && camera.aspect < 1 ? .65 : 1) : .001; form.scale.setScalar(THREE.MathUtils.lerp(form.scale.x, target, damping)); form.visible = i === selected || form.scale.x > .01; });
        const targetX = home !== undefined ? (home === 0 ? 0 : (camera.aspect < 1 ? .48 : home === 1 ? 2.45 : home === 2 ? 2.45 : 2.4)) : chapter === 0 ? 0 : (camera.aspect < 1 ? 1.0 : 2.25);
        root.position.x = THREE.MathUtils.lerp(root.position.x, targetX, damping);
        root.position.y = THREE.MathUtils.lerp(root.position.y, camera.aspect < 1 && (home === 1 || home === 2) ? 1.0 : home === 1 ? .25 : 0, damping);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8.8 - (home === undefined ? (state.progress ?? 0) * 1.7 : home * .18) + (reduced() ? 0 : Math.sin(time * .3) * .12), damping);
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointerX * .4, damping);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, -pointerY * .22, damping);
        if (forms[1]) forms[1].rotation.y = (state.profile ?? 1) * .35 + time * .12;
        if (forms[2]) forms[2].children.forEach((slab, i) => { slab.rotation.y = THREE.MathUtils.lerp(slab.rotation.y, (i - 3) * .10 / (1 + (state.selected ?? 0)), damping); });
        if (forms[3] && !reduced()) forms[3].rotation.z += dt * .18;
      }
      if (kind === 'core') root.position.x = reduced() ? 0 : Math.sin(time * 95) * impulse * .035;
      root.rotation.y = x + (reduced() ? 0 : time * (state.goal === 'fps' && phase === 3 && kind !== 'core' ? .36 : .12)) + pointerX * .15 + (kind === 'sculpture' ? window.scrollY * .00045 : 0);
      root.rotation.x = y + pointerY * .13 + .18;
      rings.forEach((ring, i) => {
        const target = kind === 'core' ? 1 : phase === 1 ? .86 + i * .07 : phase === 2 && state.accepted ? 1.22 : phase === 3 ? (state.goal === 'smooth' ? .75 : state.goal === 'fps' ? 1.35 : 1) : 1;
        const scale = target + impulse * .08;
        ring.scale.setScalar(reduced() ? scale : THREE.MathUtils.lerp(ring.scale.x, scale, Math.min(1, dt * 4)));
        if (!reduced()) ring.rotation.z += dt * (i % 2 ? -.12 : .14);
      });
      if (core) { core.scale.setScalar(kind === 'core' ? 1 : (phase === 2 && state.accepted ? .78 : phase === 3 && state.goal === 'balanced' ? 1.14 : 1) + impulse * .08); if (!reduced()) core.rotation.y += dt * .14; }
    } else if (kind === 'balance') {
      root.rotation.y = -.34 + x; root.rotation.x = y;
      bars.forEach((bar, i) => { const value = Math.max(.01, Math.min(10, state.values?.[i] ?? 0)) * .32; bar.scale.y = value; bar.position.y = value / 2; });
    } else if (wave) {
      (wave.material as THREE.ShaderMaterial).uniforms.time.value = time;
    }
    if (backgroundMaterial) {
      const light = state.homeScene === 1 || state.homeScene === 2 ? 1 : 0;
      themeMix = THREE.MathUtils.lerp(themeMix, light, reduced() ? 1 : Math.min(1, dt * 2));
      backgroundMaterial.uniforms.theme.value = themeMix; backgroundMaterial.uniforms.clock.value = time; glitchStrength *= .90; backgroundMaterial.uniforms.glitch.value = reduced() ? 0 : glitchStrength;
      renderer.clear(); renderer.render(backgroundScene, backgroundCamera); renderer.clearDepth();
      if (landscapeMaterial) {
        landscapeMaterial.uniforms.clock.value = time; landscapeMaterial.uniforms.light.value = themeMix;
        const targetX = pointerX * 1.2 + (state.homeScene ?? 0) * .45;
        landscapeCamera.position.x = THREE.MathUtils.lerp(landscapeCamera.position.x, targetX, reduced() ? 1 : Math.min(1,dt*1.8));
        landscapeCamera.lookAt(0, -1.4 + pointerY * .3, -15); renderer.render(landscape, landscapeCamera); renderer.clearDepth();
      }
      if (canvas.dataset.homeScene !== String(state.homeScene ?? '')) canvas.dataset.homeScene = String(state.homeScene ?? ''); canvas.dataset.form = state.homeScene === undefined ? 'interior' : ['chrome-rings','obsidian-prisms','obsidian-geodesic','silver-core'][state.homeScene] ?? 'chrome-rings';
      canvas.dataset.theme = themeMix > .5 ? 'light' : 'dark';
    }
    renderer.render(scene, camera);
    if (kind === 'cinematic' && canvas.dataset.chapter !== String(state.chapter ?? 0)) canvas.dataset.chapter = String(state.chapter ?? 0);
    if (!reduced() && (kind !== 'balance' || dragging || Math.abs(vx) + Math.abs(vy) > .0001)) frame = requestAnimationFrame(render);
  }
  function wake() { previous = 0; if (!frame && alive && visible && !document.hidden) frame = requestAnimationFrame(render); }
  function resize() { const box = canvas.getBoundingClientRect(); if (box.width && box.height) { renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; landscapeCamera.aspect = camera.aspect; landscapeCamera.updateProjectionMatrix();
    if (kind === 'balance') { const factor = Math.max(1, 1.5 / camera.aspect); camera.position.set(0, 3.3 * factor, 10 * factor); camera.lookAt(0, 1, 0); }
    camera.updateProjectionMatrix(); wake(); } }
  function down(e: PointerEvent) { if (kind === 'wave' || kind === 'core') return; dragging = true; lastX = e.clientX; lastY = e.clientY; vx = vy = 0; impulse = 1; canvas.setPointerCapture(e.pointerId); wake(); }
  function move(e: PointerEvent) {
    if (dragging) { vx = (e.clientX - lastX) * .008; vy = (e.clientY - lastY) * .008; x += vx; y = THREE.MathUtils.clamp(y + vy, -1.1, 1.1); lastX = e.clientX; lastY = e.clientY; canvas.dataset.rotation = `${x.toFixed(3)},${y.toFixed(3)}`; wake(); }
    else { pointerX = e.clientX / Math.max(1, innerWidth) - .5; pointerY = e.clientY / Math.max(1, innerHeight) - .5; }
  }
  function up() { dragging = false; wake(); }
  function keydown(e: KeyboardEvent) { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); x += e.key === 'ArrowLeft' ? -.15 : e.key === 'ArrowRight' ? .15 : 0; y = THREE.MathUtils.clamp(y + (e.key === 'ArrowUp' ? -.15 : e.key === 'ArrowDown' ? .15 : 0), -1.1, 1.1); wake(); }
  function externalDrag(e: Event) { if (kind !== 'cinematic') return; const d = (e as CustomEvent<{dx: number; dy: number; end: boolean}>).detail; if (!d) return; if (!d.end) { vx = d.dx * .006; vy = d.dy * .006; x += vx; y = THREE.MathUtils.clamp(y + vy, -1.1, 1.1); impulse = .6; canvas.dataset.rotation = `${x.toFixed(3)},${y.toFixed(3)}`; } wake(); }
  const glitch = () => { if (kind === 'cinematic' && !reduced()) { glitchStrength = 1; wake(); } };
  window.addEventListener('shift:glitch-pulse', glitch);
  window.addEventListener('shift:scene-drag', externalDrag);
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; } }); intersection.observe(canvas);
  const mutations = new MutationObserver(wake); mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-onboarding', 'inert'], subtree: true });
  canvas.addEventListener('pointerdown', down); window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake); window.addEventListener('scroll', wake, { passive: true });
  if (initial.values) canvas.dataset.values = initial.values.join(",");
  if (initial.step !== undefined) canvas.dataset.step = String(initial.step);
  resize();
  return {
    update(next: SceneState) { if (next.homeScene !== state.homeScene || next.chapter !== state.chapter) glitchStrength = 1; if (kind === 'core' && next.step !== state.step && !reduced()) impulse = .7; state = next; if (next.profile !== undefined) canvas.dataset.profile = String(next.profile); if (next.selected !== undefined) canvas.dataset.selected = String(next.selected); if (next.step !== undefined) canvas.dataset.step = String(next.step); if (next.goal) canvas.dataset.goal = next.goal; if (next.values) canvas.dataset.values = next.values.join(","); wake(); },
    dispose() { alive = false; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); mutations.disconnect(); canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake); window.removeEventListener('scroll', wake); window.removeEventListener('shift:scene-drag', externalDrag); window.removeEventListener('shift:glitch-pulse', glitch); resources.forEach(r => r.dispose()); renderer.dispose(); renderer.forceContextLoss(); },
  };
}
