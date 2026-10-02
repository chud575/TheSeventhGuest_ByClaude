import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GLSL_COMMON } from './glsl/common.js';

/**
 * TextureForge: GPU procedural PBR texture generator.
 *
 * A generator is a GLSL snippet defining
 *     void surface(vec2 uv, inout Surface s)
 * where Surface = { vec3 albedo (sRGB authored); float height (0..1); float rough;
 *                   float metal; float ao; float alpha; }
 * The forge renders it (MRT) at the requested resolution, derives a tangent-space
 * normal map from the height field (Sobel), reads everything back into regular
 * DataTextures (so clones with different .repeat share one GPU upload) and caches
 * the result by key.
 *
 * Result (TextureSet): { map, normalMap, ormMap, roughnessMap, metalnessMap, aoMap,
 *                        width, height, key }
 * ORM packing follows glTF: R = ambient occlusion, G = roughness, B = metalness.
 */

const VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function surfaceFrag(body, uniformDecl) {
  return /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
layout(location = 0) out vec4 oAlbedo;
layout(location = 1) out vec4 oORM;
layout(location = 2) out vec4 oHeight;
uniform vec2 uResolution;
uniform float uSeed;
uniform float uAspect;
${uniformDecl}
#define texture2D texture
${GLSL_COMMON}
struct Surface { vec3 albedo; float height; float rough; float metal; float ao; float alpha; };
${body}
void main() {
  Surface s = Surface(vec3(0.5), 0.5, 0.8, 0.0, 1.0, 1.0);
  surface(vUv, s);
  oAlbedo = vec4(srgb2lin(saturate(s.albedo)), saturate(s.alpha));
  oORM = vec4(saturate(s.ao), clamp(s.rough, 0.02, 1.0), saturate(s.metal), 1.0);
  oHeight = vec4(s.height, 0.0, 0.0, 1.0);
}
`;
}

const NORMAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 oNormal;
uniform sampler2D tHeight;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uTile;
float h(vec2 o) {
  vec2 uv = vUv + o * uTexel;
  uv = uTile > 0.5 ? fract(uv) : clamp(uv, uTexel * 0.5, 1.0 - uTexel * 0.5);
  return texture(tHeight, uv).r;
}
void main() {
  float tl = h(vec2(-1, 1)), t = h(vec2(0, 1)), tr = h(vec2(1, 1));
  float l = h(vec2(-1, 0)), r = h(vec2(1, 0));
  float bl = h(vec2(-1, -1)), b = h(vec2(0, -1)), br = h(vec2(1, -1));
  // Sobel gradient in "height per uv unit"
  float dx = ((tr + 2.0 * r + br) - (tl + 2.0 * l + bl)) / (8.0 * uTexel.x);
  float dy = ((tl + 2.0 * t + tr) - (bl + 2.0 * b + br)) / (8.0 * uTexel.y);
  vec3 n = normalize(vec3(-dx * uStrength, -dy * uStrength, 1.0));
  oNormal = vec4(n * 0.5 + 0.5, 1.0);
}
`;

function glslType(v) {
  if (typeof v === 'number') return 'float';
  if (typeof v === 'boolean') return 'bool';
  if (v?.isVector2) return 'vec2';
  if (v?.isVector3 || v?.isColor) return 'vec3';
  if (v?.isVector4) return 'vec4';
  if (v?.isTexture) return 'sampler2D';
  if (Array.isArray(v)) return ['float', 'float', 'vec2', 'vec3', 'vec4'][v.length] || 'float';
  return 'float';
}
function toUniformValue(v) {
  if (Array.isArray(v)) {
    if (v.length === 2) return new THREE.Vector2(...v);
    if (v.length === 3) return new THREE.Vector3(...v);
    if (v.length === 4) return new THREE.Vector4(...v);
  }
  if (v?.isColor) return new THREE.Vector3(v.r, v.g, v.b);
  return v;
}

export class TextureForge {
  constructor(renderer, { defaultSize = 1024, anisotropy = 8 } = {}) {
    this.renderer = renderer;
    this.defaultSize = defaultSize;
    this.anisotropy = Math.min(anisotropy, renderer.capabilities.getMaxAnisotropy());
    this.cache = new Map();
    this.quad = new FullScreenQuad(null);
    this.programs = new Map();
    this.normalMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: NORMAL_FRAG,
      uniforms: { tHeight: { value: null }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: 1 }, uTile: { value: 1 } },
      depthTest: false, depthWrite: false,
    });
    this.stats = { generated: 0, ms: 0 };
    this.releaseLarge = true;
  }

  /**
   * @param {string} key unique cache key (include every parameter that changes the output)
   * @param {object} def { glsl, uniforms?, size?, aspect? (w/h), normalStrength?, tile?, seed? }
   * @returns {TextureSet}
   */
  generate(key, def) {
    const size = def.size || this.defaultSize;
    const aspect = def.aspect || 1;
    const fullKey = `${key}@${size}x${aspect}`;
    const hit = this.cache.get(fullKey);
    if (hit) return hit;
    const t0 = performance.now();

    const w = aspect >= 1 ? size : Math.max(8, Math.round(size * aspect));
    const h = aspect >= 1 ? Math.max(8, Math.round(size / aspect)) : size;
    const r = this.renderer;
    const tile = def.tile !== false;

    // --- surface pass (MRT)
    const rt = new THREE.WebGLRenderTarget(w, h, { count: 3, depthBuffer: false, type: THREE.UnsignedByteType });
    const [tA, tO, tH] = rt.textures;
    tA.colorSpace = THREE.SRGBColorSpace;
    tO.colorSpace = THREE.NoColorSpace;
    tH.type = THREE.HalfFloatType;
    tH.colorSpace = THREE.NoColorSpace;
    for (const t of rt.textures) {
      t.wrapS = t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    }

    const uniforms = {
      uResolution: { value: new THREE.Vector2(w, h) },
      uSeed: { value: def.seed ?? 0 },
      uAspect: { value: w / h },
    };
    let decl = '';
    for (const [name, v] of Object.entries(def.uniforms || {})) {
      uniforms[name] = { value: toUniformValue(v) };
      decl += `uniform ${glslType(v)} ${name};\n`;
    }
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: surfaceFrag(def.glsl, decl),
      uniforms,
      depthTest: false, depthWrite: false,
    });

    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(rt);
    this.quad.material = mat;
    this.quad.render(r);

    // --- normal pass
    const nrt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, type: THREE.UnsignedByteType });
    this.normalMat.uniforms.tHeight.value = tH;
    this.normalMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.normalMat.uniforms.uStrength.value = (def.normalStrength ?? 1) * 0.02;
    this.normalMat.uniforms.uTile.value = tile ? 1 : 0;
    r.setRenderTarget(nrt);
    this.quad.material = this.normalMat;
    this.quad.render(r);

    // --- read back into regular textures
    const read = (target, index) => {
      const buf = new Uint8Array(w * h * 4);
      r.readRenderTargetPixels(target, 0, 0, w, h, buf, undefined, index);
      return buf;
    };
    const albedo = read(rt, 0);
    const orm = read(rt, 1);
    const normal = read(nrt, 0);
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
    rt.dispose(); nrt.dispose(); mat.dispose();

    const mk = (data, srgb) => {
      const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = this.anisotropy;
      t.flipY = false;
      t.needsUpdate = true;
      t.name = key;
      if (this.releaseLarge && w * h >= 2048 * 2048) {
        t.onUpdate = () => { t.image.data = null; t.onUpdate = null; };
      }
      return t;
    };
    const map = mk(albedo, true);
    const normalMap = mk(normal, false);
    const ormMap = mk(orm, false);
    const set = {
      key, width: w, height: h,
      map, normalMap, ormMap,
      roughnessMap: ormMap, metalnessMap: ormMap, aoMap: ormMap,
      /** returns clones of the maps with the given repeat (shares GPU memory) */
      withRepeat(rx, ry = rx, rotation = 0, offset = [0, 0]) {
        const c = (t) => { const k = t.clone(); k.repeat.set(rx, ry); k.rotation = rotation; k.offset.set(offset[0], offset[1]); k.needsUpdate = false; return k; };
        const o = c(ormMap);
        return { map: c(map), normalMap: c(normalMap), ormMap: o, roughnessMap: o, metalnessMap: o, aoMap: o };
      },
    };
    this.cache.set(fullKey, set);
    this.stats.generated++;
    this.stats.ms += performance.now() - t0;
    return set;
  }

  /** Make a CanvasTexture from a 2D drawing callback, cached. */
  canvas(key, w, h, draw, { srgb = true, tile = true } = {}) {
    const k = `canvas:${key}@${w}x${h}`;
    if (this.cache.has(k)) return this.cache.get(k);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = this.anisotropy;
    this.cache.set(k, t);
    return t;
  }

  dispose() {
    for (const v of this.cache.values()) {
      if (v.isTexture) v.dispose();
      else { v.map?.dispose(); v.normalMap?.dispose(); v.ormMap?.dispose(); }
    }
    this.cache.clear();
    this.normalMat.dispose();
  }
}
