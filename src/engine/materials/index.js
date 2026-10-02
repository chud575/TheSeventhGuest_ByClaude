import * as THREE from 'three';
import { damask } from './generators/damask.js';
import { wood, WOOD_SPECIES } from './generators/wood.js';
import { parquet } from './generators/parquet.js';
import { rug, RUG_PALETTES } from './generators/rug.js';
import { gilded } from './generators/gilded.js';
import { painting } from './generators/painting.js';
import { books } from './generators/books.js';
import { marble, plaster, velvet, brass, glass, wax, leather, brick, stone, checker, MARBLE_TYPES } from './generators/surfaces.js';

export const GENERATORS = { damask, wood, parquet, rug, gilded, painting, books, marble, plaster, velvet, brass, glass, wax, leather, brick, stone, checker };
export { WOOD_SPECIES, RUG_PALETTES, MARBLE_TYPES };

/**
 * MaterialLibrary — the one-stop shop for room authors.
 *
 *   const wall = ctx.materials.create('damask', { repeat: [3, 2] });
 *   const floor = ctx.materials.create('parquet', { species: 'oak', repeat: [2, 2] });
 *   const rugMat = ctx.materials.create('rug', { palette: 'heriz', aspect: 0.66 });
 *   const tex = ctx.materials.textures('wood', { species: 'walnut' }); // raw TextureSet
 *
 * Every generator option can be passed to create(); material options are:
 *   repeat [x,y], rotation, offset, color (multiplier), roughness (multiplier),
 *   metalness, normalScale, envMapIntensity, clearcoat, sheen, side, transparent,
 *   opacity, emissive, emissiveIntensity, macro (anti-tiling world noise 0..1),
 *   size (texture resolution override)
 */
export class MaterialLibrary {
  constructor(forge, { quality } = {}) {
    this.forge = forge;
    this.quality = quality;
    this.materials = new Set();
  }

  /** Generate (or fetch cached) TextureSet for a generator. */
  textures(name, params = {}) {
    const gen = GENERATORS[name];
    if (!gen) throw new Error(`[materials] unknown generator "${name}"`);
    const def = gen(params);
    if (params.size) def.size = params.size;
    if (!def.size) def.size = this.forge.defaultSize;
    if (params.sizeScale) def.size = Math.max(64, Math.round(def.size * params.sizeScale));
    return this.forge.generate(def.key, def);
  }

  /** Create a PBR material from a generator name + options. */
  create(name, opts = {}) {
    const preset = MATERIAL_PRESETS[name] || {};
    const genName = preset.generator || name;
    const params = { ...(preset.params || {}), ...opts };
    const set = this.textures(genName, params);
    const rep = params.repeat || [1, 1];
    const maps = (rep[0] !== 1 || rep[1] !== 1 || params.rotation || params.offset)
      ? set.withRepeat(rep[0], rep[1], params.rotation || 0, params.offset || [0, 0])
      : set;
    const kind = params.physical ?? preset.physical ?? false;
    const M = kind ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new M({
      map: maps.map,
      normalMap: maps.normalMap,
      roughnessMap: maps.roughnessMap,
      metalnessMap: maps.metalnessMap,
      aoMap: params.aoMap === false ? null : maps.aoMap,
      aoMapIntensity: params.aoIntensity ?? 1,
      roughness: params.roughness ?? 1,
      metalness: params.metalness ?? 1,
      normalScale: new THREE.Vector2(params.normalScale ?? 1, params.normalScale ?? 1),
      color: params.color !== undefined ? new THREE.Color(params.color) : new THREE.Color(1, 1, 1),
      envMapIntensity: params.envMapIntensity ?? preset.envMapIntensity ?? 1,
      side: params.side ?? THREE.FrontSide,
      transparent: params.transparent ?? false,
      opacity: params.opacity ?? 1,
      alphaTest: params.alphaTest ?? 0,
      emissive: params.emissive !== undefined ? new THREE.Color(params.emissive) : new THREE.Color(0),
      emissiveIntensity: params.emissiveIntensity ?? 1,
      name: `${name}`,
    });
    if (params.alphaTest || params.transparent) m.alphaMap = null;
    if (kind) {
      const pp = { ...(preset.physicalParams || {}), ...(params.physicalParams || {}) };
      for (const k of ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'transmission', 'thickness', 'ior', 'specularIntensity', 'iridescence', 'anisotropy']) {
        if (params[k] !== undefined) pp[k] = params[k];
      }
      if (params.sheenColor !== undefined) pp.sheenColor = params.sheenColor;
      if (pp.sheenColor !== undefined) { m.sheenColor = new THREE.Color(...[].concat(pp.sheenColor)); delete pp.sheenColor; }
      Object.assign(m, pp);
    }
    if (params.macro ?? preset.macro) applyMacroVariation(m, { amount: params.macro ?? preset.macro, scale: params.macroScale ?? 0.6 });
    m.userData.textureSet = set;
    this.materials.add(m);
    return m;
  }

  /** Simple untextured materials with sane PBR values. */
  basic(kind, opts = {}) {
    const p = BASIC[kind] || {};
    const M = p.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new M({ ...p.params, ...opts });
    this.materials.add(m);
    return m;
  }

  disposeMaterials() {
    for (const m of this.materials) m.dispose();
    this.materials.clear();
  }
}

const MATERIAL_PRESETS = {
  damask: { params: {}, macro: 0.35 },
  wallpaper: { generator: 'damask', macro: 0.35 },
  wood: { physical: true, physicalParams: { clearcoat: 0.35, clearcoatRoughness: 0.35 }, macro: 0.2 },
  mahogany: { generator: 'wood', params: { species: 'mahogany', polish: 0.8, boards: 0 }, physical: true, physicalParams: { clearcoat: 0.6, clearcoatRoughness: 0.22 } },
  walnut: { generator: 'wood', params: { species: 'walnut', polish: 0.7, boards: 0 }, physical: true, physicalParams: { clearcoat: 0.45, clearcoatRoughness: 0.28 } },
  ebony: { generator: 'wood', params: { species: 'ebony', polish: 0.9, boards: 0 }, physical: true, physicalParams: { clearcoat: 0.7, clearcoatRoughness: 0.15 } },
  floorboards: { generator: 'wood', params: { species: 'oak', boards: 4, boardLength: 0.5, polish: 0.4, wear: 0.5 }, physical: true, physicalParams: { clearcoat: 0.2, clearcoatRoughness: 0.4 }, macro: 0.35 },
  parquet: { physical: true, physicalParams: { clearcoat: 0.3, clearcoatRoughness: 0.3 }, macro: 0.35 },
  rug: { physical: true, physicalParams: { sheen: 0.6, sheenRoughness: 0.6, sheenColor: [0.6, 0.5, 0.45] }, envMapIntensity: 0.5 },
  gilded: { envMapIntensity: 1.2 },
  gold: { generator: 'gilded', params: { pattern: 4 }, envMapIntensity: 1.2 },
  marble: { physical: true, physicalParams: { clearcoat: 0.5, clearcoatRoughness: 0.08 } },
  checker: { physical: true, physicalParams: { clearcoat: 0.4, clearcoatRoughness: 0.1 }, macro: 0.25 },
  plaster: { macro: 0.4 },
  velvet: { physical: true, physicalParams: { sheen: 1.0, sheenRoughness: 0.45, sheenColor: [0.55, 0.6, 0.85] }, envMapIntensity: 0.4 },
  brass: { envMapIntensity: 1.1 },
  glass: { physical: true, params: { transparent: true, opacity: 0.25 }, physicalParams: { clearcoat: 1.0, clearcoatRoughness: 0.03, ior: 1.5, specularIntensity: 1 } },
  wax: { physical: true, physicalParams: { sheen: 0.3, sheenRoughness: 0.8, sheenColor: [1, 0.9, 0.7] } },
  leather: { physical: true, physicalParams: { clearcoat: 0.25, clearcoatRoughness: 0.5 } },
  brick: { macro: 0.3 },
  stone: { macro: 0.4 },
  books: {},
  painting: { physical: true, physicalParams: { clearcoat: 0.35, clearcoatRoughness: 0.25 }, envMapIntensity: 0.6 },
};

const BASIC = {
  black: { params: { color: 0x050505, roughness: 0.6, metalness: 0 } },
  iron: { params: { color: 0x2a2a2c, roughness: 0.55, metalness: 1 } },
  silver: { params: { color: 0xd8d8dc, roughness: 0.18, metalness: 1 } },
  gold: { params: { color: 0xf0c060, roughness: 0.22, metalness: 1 } },
  porcelain: { physical: true, params: { color: 0xf2efe8, roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 } },
  bone: { params: { color: 0xd9ccb0, roughness: 0.55, metalness: 0 } },
  cloth: { physical: true, params: { color: 0xe8e4da, roughness: 0.9, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(1, 1, 1) } },
  crystal: { physical: true, params: { color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.35, ior: 1.6, clearcoat: 1, specularIntensity: 1 } },
  emissiveWarm: { params: { color: 0x000000, emissive: 0xffb060, emissiveIntensity: 4 } },
  emissiveMoon: { params: { color: 0x000000, emissive: 0x9fb8ff, emissiveIntensity: 3 } },
};

/**
 * Anti-tiling: modulates albedo + roughness with world-space low-frequency noise
 * so that repeating textures don't read as wallpaper-of-wallpaper. Safe to call
 * on any MeshStandard/Physical material.
 */
export function applyMacroVariation(material, { amount = 0.3, scale = 0.6 } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uMacroAmount = { value: amount };
    shader.uniforms.uMacroScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMacroW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMacroW;
uniform float uMacroAmount;
uniform float uMacroScale;
float mHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mHash(i + vec3(0,0,0)), mHash(i + vec3(1,0,0)), f.x), mix(mHash(i + vec3(0,1,0)), mHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mHash(i + vec3(0,0,1)), mHash(i + vec3(1,0,1)), f.x), mix(mHash(i + vec3(0,1,1)), mHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float macroN() { vec3 p = vMacroW * uMacroScale; return mNoise(p) * 0.6 + mNoise(p * 2.7 + 11.0) * 0.4; }
`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float _mn = macroN();
diffuseColor.rgb *= 1.0 + (_mn - 0.5) * 0.5 * uMacroAmount;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (1.0 + (macroN() - 0.5) * 0.6 * uMacroAmount), 0.03, 1.0);`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|macro';
  material.needsUpdate = true;
  return material;
}
