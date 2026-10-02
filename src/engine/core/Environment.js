import * as THREE from 'three';

/**
 * Generated "Victorian interior at night" environment for image-based lighting:
 * dark blue walls, a cool moonlit window, a few warm lamp glows and a dim
 * ceiling. Used as the default scene.environment until a room bakes its own.
 */
export function createInteriorEnvironment(renderer, { size = 128 } = {}) {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 5, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.018, 0.022, 0.04), side: THREE.BackSide }),
  );
  room.position.y = 2.5;
  scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.012, 0.008) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01;
  scene.add(floor);
  const emissive = (w, h, color, mult, pos, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color).multiplyScalar(mult), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.y = rotY;
    scene.add(m);
  };
  // moonlit window (cool), two warm lamps, faint warm fire glow low on one wall
  emissive(1.4, 2.2, [0.55, 0.68, 1.0], 2.2, [0, 2.4, -5.95]);
  emissive(0.5, 0.5, [1.0, 0.62, 0.3], 6, [-5.9, 2.2, 1.5], Math.PI / 2);
  emissive(0.5, 0.5, [1.0, 0.62, 0.3], 5, [5.9, 2.2, -1.0], -Math.PI / 2);
  emissive(1.6, 0.8, [1.0, 0.45, 0.15], 1.5, [3, 0.6, 5.95], Math.PI);
  // dim gilded cornice band (gives gold something to reflect)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.9, 0.15, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.09, 0.04), side: THREE.BackSide }));
  band.position.y = 4.6; scene.add(band);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03, 0.1, 50, { size, position: new THREE.Vector3(0, 1.6, 0) });
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return rt;
}

/** Bake an environment map from the actual room (reflections of the real room in gold, glass, varnish). */
export function bakeRoomEnvironment(renderer, scene, position, { size = 128, near = 0.05, far = 60, sigma = 0.0 } = {}) {
  const prevEnv = scene.environment;
  scene.environment = null;
  // transient FX (volumetrics, dust, ghosts...) must not end up baked into the lighting
  const hidden = [];
  scene.traverse((o) => { if ((o.userData?.noBake || o.material?.userData?.noBake) && o.visible) { o.visible = false; hidden.push(o); } });
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, sigma, near, far, { size, position });
  pmrem.dispose();
  for (const o of hidden) o.visible = true;
  scene.environment = prevEnv;
  return rt;
}
