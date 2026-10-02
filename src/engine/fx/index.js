import * as THREE from 'three';
import { createFlame, flicker } from './Flame.js';
import { LightShaft, DustMotes, FogVolume, windowCookie } from './Volumetrics.js';
import { createGhostMaterial } from './Ghost.js';

export { createFlame, flicker, LightShaft, DustMotes, FogVolume, windowCookie, createGhostMaterial };

/**
 * FX manager handed to rooms as ctx.fx. Everything it creates animates from the
 * shared time uniform; objects that need CPU updates (light flicker) register
 * an updater that the engine ticks each frame and clears on room unload.
 */
export class FXManager {
  constructor({ timeUniform, materials, quality, random, renderer }) {
    this.time = timeUniform;
    this.materials = materials;
    this.quality = quality;
    this.random = random;
    this.renderer = renderer;
    this.updaters = new Set();
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }
  update(dt, t) { for (const fn of this.updaters) fn(dt, t); }
  clear() { this.updaters.clear(); }

  flame(opts = {}) { return createFlame({ timeUniform: this.time, ...opts }); }

  /**
   * A lit wax candle: melted-top wax body, wick, flame and (optionally) a flickering
   * point light. Origin = base of the candle.
   */
  candle({ height = 0.22, radius = 0.011, lit = true, light = true, lightIntensity = 1.2, lightDistance = 4, lightColor = 0xffa45a, castShadow = false, shadowMapSize = 256, seed, waxColor = [0.9, 0.85, 0.72], burn = 0.7 } = {}) {
    const g = new THREE.Group();
    g.name = 'candle';
    const s = seed ?? this.random.next() * 100;
    // wax body via lathe with a melted, slightly concave top and a drip lip
    const pts = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const y = (i / segs) * height;
      const bulge = 1 + 0.03 * Math.sin(i * 1.7 + s);
      pts.push(new THREE.Vector2(radius * bulge, y));
    }
    pts.push(new THREE.Vector2(radius * 1.04, height + radius * 0.15));
    pts.push(new THREE.Vector2(radius * 0.75, height + radius * 0.05));
    pts.push(new THREE.Vector2(radius * 0.25, height - radius * 0.12));
    pts.push(new THREE.Vector2(0.0001, height - radius * 0.15));
    const geo = new THREE.LatheGeometry(pts, 24);
    const wax = this.materials.create('wax', { color: new THREE.Color(...waxColor), drips: burn, size: 256 });
    wax.emissive = new THREE.Color(1.0, 0.55, 0.2);
    wax.emissiveIntensity = lit ? 0.04 : 0;
    const body = new THREE.Mesh(geo, wax);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0011, radius * 1.1, 5), new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.9 }));
    wick.position.y = height + radius * 0.4;
    wick.rotation.z = 0.15;
    g.add(wick);
    let flame = null, pl = null;
    if (lit) {
      flame = this.flame({ height: 0.05 * (radius / 0.011) ** 0.3, width: 0.011, seed: s });
      flame.position.y = height + radius * 0.55;
      g.add(flame);
      if (light) {
        pl = new THREE.PointLight(lightColor, lightIntensity, lightDistance, 2);
        pl.position.y = height + 0.06;
        pl.castShadow = castShadow && this.quality.shadows;
        if (pl.castShadow) {
          pl.shadow.mapSize.set(shadowMapSize, shadowMapSize);
          pl.shadow.bias = -0.002; pl.shadow.normalBias = 0.02;
          pl.shadow.radius = 3;
          pl.shadow.camera.near = 0.03;
        }
        g.add(pl);
      }
      const base = lightIntensity;
      this.onUpdate((dt, t) => {
        const f = flicker(t, s);
        if (pl) { pl.intensity = base * f; pl.position.x = Math.sin(t * 3.1 + s) * 0.004; }
        wax.emissiveIntensity = 0.04 * f;
      });
    }
    g.userData = { flame, light: pl, body };
    return g;
  }

  /** Window moon beam (see LightShaft). */
  shaft(opts) { return new LightShaft({ timeUniform: this.time, steps: this.quality.volumetricSteps, ...opts }); }

  dust({ count = 1500, ...opts }) {
    return new DustMotes({ timeUniform: this.time, random: this.random.fork('dust'), count: Math.round(count * (this.quality.particles ?? 1)), pixelRatio: this.renderer.getPixelRatio(), ...opts });
  }

  fog(opts) { return new FogVolume({ timeUniform: this.time, steps: Math.max(6, Math.round((this.quality.volumetricSteps || 12) * 0.75)), ...opts }); }

  ghostMaterial(opts = {}) { return createGhostMaterial({ timeUniform: this.time, ...opts }); }

  windowCookie(opts) { return windowCookie(opts); }

  /**
   * Soft area "spill" light from a window/doorway (RectAreaLight, no shadows):
   * the cheapest way to get believable cool moonlit fill on walls and floor.
   * center/normal in world space; normal points INTO the room.
   */
  areaLight({ center, normal, width = 1.2, height = 2, color = 0x8fa8ff, intensity = 2 }) {
    const l = new THREE.RectAreaLight(color, intensity, width, height);
    const c = center.isVector3 ? center : new THREE.Vector3(...center);
    const n = (normal.isVector3 ? normal : new THREE.Vector3(...normal)).clone().normalize();
    l.position.copy(c);
    l.lookAt(c.clone().add(n));
    return l;
  }
}
