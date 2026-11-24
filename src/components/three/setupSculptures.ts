import * as THREE from 'three';
import type { SceneState } from './scene';

type Resource = THREE.BufferGeometry | THREE.Material | THREE.Texture;
type Track = <T extends Resource>(resource: T) => T;
type Facet = { mesh: THREE.Mesh; center: THREE.Vector3; normal: THREE.Vector3 };

/** Three independent forms share the renderer and lightbox, but never geometry. */
export function createSetupSculptures(root: THREE.Group, orbit: THREE.Group, chrome: THREE.Material, graphite: THREE.Material, track: Track, software: boolean) {
  const forms = [orbit];

  // Two interwoven closed torus knots: one satin surface and a finer dark ribbon.
  const knot = new THREE.Group();
  const polished = new THREE.Mesh(track(new THREE.TorusKnotGeometry(1.05, .20, software ? 150 : 260, software ? 10 : 18, 2, 3)), chrome);
  const ribbon = new THREE.Mesh(track(new THREE.TorusKnotGeometry(1.05, .075, software ? 150 : 260, software ? 8 : 14, 2, 3)), graphite);
  ribbon.rotation.z = .58; ribbon.rotation.x = .35;
  knot.add(polished, ribbon); knot.rotation.x = .28; root.add(knot); forms.push(knot);

  // Twenty separately positioned facets create a real opening/closing shell.
  const crystal = new THREE.Group();
  const source = track(new THREE.IcosahedronGeometry(1.5, 0));
  const geometry = source.index ? track(source.toNonIndexed()) : source;
  const positions = geometry.getAttribute('position');
  const facets: Facet[] = [];
  for (let i = 0; i < positions.count; i += 3) {
    const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, i + j));
    const center = vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
    const normal = center.clone().normalize();
    const coords = vertices.flatMap(vertex => vertex.sub(center).toArray());
    const face = track(new THREE.BufferGeometry());
    face.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3)); face.computeVertexNormals();
    const mesh = new THREE.Mesh(face, (i / 3) % 3 === 0 ? graphite : chrome);
    mesh.position.copy(center).multiplyScalar(1.22); crystal.add(mesh);
    facets.push({ mesh, center, normal });
  }
  const inner = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.0, 0)), graphite); crystal.add(inner);
  const skeleton = new THREE.LineSegments(track(new THREE.EdgesGeometry(source)), track(new THREE.LineBasicMaterial({ color: 0xf5f5f7, transparent: true, opacity: .42 })));
  crystal.add(skeleton); crystal.rotation.set(.15, .2, .12); root.add(crystal); forms.push(crystal);

  forms.forEach((form, index) => { if (index) { form.scale.setScalar(.001); form.visible = false; } });

  const names = ['orbit-sphere', 'titanium-torus-knot', 'crystal-shield'];
  function update(state: SceneState, dt: number, time: number, reduced: boolean, canvas: HTMLCanvasElement) {
    const step = Math.max(0, Math.min(2, Math.floor(state.step ?? 0)));
    const damping = reduced ? 1 : 1 - Math.exp(-dt * 5);
    forms.forEach((form, index) => {
      const scale = THREE.MathUtils.lerp(form.scale.x, index === step ? 1 : .001, damping);
      form.scale.setScalar(scale); form.visible = index === step || scale > .012;
    });
    if (!reduced) { knot.rotation.y += dt * .27; crystal.rotation.y += dt * .16; }
    const gap = state.accepted ? 1 : 1.22;
    facets.forEach(({ mesh, center, normal }, i) => {
      mesh.position.set(
        THREE.MathUtils.lerp(mesh.position.x, center.x * gap, damping),
        THREE.MathUtils.lerp(mesh.position.y, center.y * gap, damping),
        THREE.MathUtils.lerp(mesh.position.z, center.z * gap, damping),
      );
      const spread = state.accepted ? 0 : .10;
      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, normal.y * spread, damping);
      mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, -normal.x * spread + (i % 2 ? .015 : -.015) * (state.accepted ? 0 : 1), damping);
    });
    canvas.dataset.setupForm = names[step];
    canvas.dataset.facetGap = (facets[0].mesh.position.length() / facets[0].center.length()).toFixed(3);
    void time;
  }
  return { update };
}
