import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { GLSL_COMMON } from '../../engine/materials/glsl/common.js';

/**
 * Exterior texture forge: same surface() contract and TextureSet output as the engine's
 * TextureForge, but the height field is carried at 16-bit precision (packed into two
 * 8-bit channels) before the Sobel normal pass. With an 8-bit / half-float height, smooth
 * low-frequency slopes quantise into terraces whose derived normals draw concentric
 * "fingerprint" contour rings across gravel, turf and stone at grazing moonlight.
 * Heights are encoded over [-1, 3].
 */

const VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function surfaceFrag(body, decl) {
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
${decl}
#define texture2D texture
${GLSL_COMMON}
struct Surface { vec3 albedo; float height; float rough; float metal; float ao; float alpha; };
${body}
void main() {
  Surface s = Surface(vec3(0.5), 0.5, 0.8, 0.0, 1.0, 1.0);
  surface(vUv, s);
  oAlbedo = vec4(srgb2lin(saturate(s.albedo)), saturate(s.alpha));
  oORM = vec4(saturate(s.ao), clamp(s.rough, 0.02, 1.0), saturate(s.metal), 1.0);
  float hq = floor(clamp((s.height + 1.0) * 0.25, 0.0, 1.0) * 65535.0 + 0.5);
  float hi = floor(hq / 256.0);
  oHeight = vec4(hi / 255.0, (hq - hi * 256.0) / 255.0, 0.0, 1.0);
}`;
}

const NORMAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 oNormal;
uniform sampler2D tHeight;
uniform vec2 uRes;
uniform float uStrength;
uniform float uTile;
float h(vec2 o) {
  vec2 p = floor(vUv * uRes) + o;
  p = uTile > 0.5 ? mod(p, uRes) : clamp(p, vec2(0.0), uRes - 1.0);
  vec4 e = texelFetch(tHeight, ivec2(p), 0);
  float hq = floor(e.r * 255.0 + 0.5) * 256.0 + floor(e.g * 255.0 + 0.5);
  return hq / 65535.0 * 4.0 - 1.0;
}
void main() {
  float tl = h(vec2(-1, 1)), t = h(vec2(0, 1)), tr = h(vec2(1, 1));
  float l = h(vec2(-1, 0)), r = h(vec2(1, 0));
  float bl = h(vec2(-1, -1)), b = h(vec2(0, -1)), br = h(vec2(1, -1));
  float dx = ((tr + 2.0 * r + br) - (tl + 2.0 * l + bl)) / 8.0 * uRes.x;
  float dy = ((tl + 2.0 * t + tr) - (bl + 2.0 * b + br)) / 8.0 * uRes.y;
  vec3 n = normalize(vec3(-dx * uStrength, -dy * uStrength, 1.0));
  oNormal = vec4(n * 0.5 + 0.5, 1.0);
}`;

function glslType(v) {
  if (typeof v === 'number') return 'float';
  if (Array.isArray(v)) return ['float', 'float', 'vec2', 'vec3', 'vec4'][v.length];
  if (v?.isColor) return 'vec3';
  if (v?.isVector2) return 'vec2';
  if (v?.isVector3) return 'vec3';
  if (v?.isVector4) return 'vec4';
  return 'float';
}
function toUniform(v) {
  if (Array.isArray(v)) {
    const C = [null, null, THREE.Vector2, THREE.Vector3, THREE.Vector4][v.length];
    return C ? new C(...v) : v[0];
  }
  if (v?.isColor) return new THREE.Vector3(v.r, v.g, v.b);
  return v;
}

const caches = new WeakMap();

export function createForge(ctx) {
  const r = ctx.renderer;
  const fallback = ctx.textures;
  if (!r || !r.readRenderTargetPixels) return fallback;
  let cache = caches.get(r);
  if (!cache) { cache = new Map(); caches.set(r, cache); }
  const quad = new FullScreenQuad(null);
  const normalMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: NORMAL_FRAG,
    uniforms: { tHeight: { value: null }, uRes: { value: new THREE.Vector2() }, uStrength: { value: 1 }, uTile: { value: 1 } },
    depthTest: false, depthWrite: false,
  });
  const aniso = Math.min(fallback.anisotropy || 8, r.capabilities.getMaxAnisotropy());

  function generate(key, def) {
    const size = def.size || 1024;
    const aspect = def.aspect || 1;
    const fullKey = `hq:${key}@${size}x${aspect}`;
    if (cache.has(fullKey)) return cache.get(fullKey);
    const w = aspect >= 1 ? size : Math.max(8, Math.round(size * aspect));
    const h = aspect >= 1 ? Math.max(8, Math.round(size / aspect)) : size;
    const tile = def.tile !== false;
    const rt = new THREE.WebGLRenderTarget(w, h, { count: 3, depthBuffer: false, type: THREE.UnsignedByteType });
    for (const t of rt.textures) {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
      t.colorSpace = THREE.NoColorSpace;
    }
    const uniforms = { uResolution: { value: new THREE.Vector2(w, h) }, uSeed: { value: def.seed ?? 0 }, uAspect: { value: w / h } };
    let decl = '';
    for (const [name, v] of Object.entries(def.uniforms || {})) { uniforms[name] = { value: toUniform(v) }; decl += `uniform ${glslType(v)} ${name};\n`; }
    const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: surfaceFrag(def.glsl, decl), uniforms, depthTest: false, depthWrite: false });
    const prevT = r.getRenderTarget(), prevAC = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(rt);
    quad.material = mat; quad.render(r);
    const nrt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, type: THREE.UnsignedByteType });
    normalMat.uniforms.tHeight.value = rt.textures[2];
    normalMat.uniforms.uRes.value.set(w, h);
    normalMat.uniforms.uStrength.value = (def.normalStrength ?? 1) * 0.02;
    normalMat.uniforms.uTile.value = tile ? 1 : 0;
    r.setRenderTarget(nrt);
    quad.material = normalMat; quad.render(r);
    const read = (target, index) => { const buf = new Uint8Array(w * h * 4); r.readRenderTargetPixels(target, 0, 0, w, h, buf, undefined, index); return buf; };
    const albedo = read(rt, 0), orm = read(rt, 1), normal = read(nrt, 0);
    r.setRenderTarget(prevT); r.autoClear = prevAC;
    rt.dispose(); nrt.dispose(); mat.dispose();
    const mk = (data, srgb) => {
      const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true; t.anisotropy = aniso; t.flipY = false; t.needsUpdate = true; t.name = key;
      return t;
    };
    const map = mk(albedo, true), normalMap = mk(normal, false), ormMap = mk(orm, false);
    const set = {
      key, width: w, height: h, map, normalMap, ormMap, roughnessMap: ormMap, metalnessMap: ormMap, aoMap: ormMap,
      withRepeat(rx, ry = rx, rotation = 0, offset = [0, 0]) {
        const c = (t) => { const k = t.clone(); k.repeat.set(rx, ry); k.rotation = rotation; k.offset.set(offset[0], offset[1]); k.needsUpdate = false; return k; };
        const o = c(ormMap);
        return { map: c(map), normalMap: c(normalMap), ormMap: o, roughnessMap: o, metalnessMap: o, aoMap: o };
      },
    };
    cache.set(fullKey, set);
    return set;
  }
  return { generate, canvas: (...a) => fallback.canvas(...a), anisotropy: aniso };
}
