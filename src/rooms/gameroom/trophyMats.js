import * as THREE from 'three';
import { peltTexture, snoutLeatherTexture } from './textures3.js';
import { hairStrandTexture, glassEyeTexture } from './textures2.js';

/** Materials for the round-4 trophies (shared by the room and the prop preview). */
export function trophyMaterials(ctx, { shield, gilt } = {}) {
  const T = ctx.textures;
  shield ||= new THREE.MeshPhysicalMaterial({ color: 0x3a2214, roughness: 0.5, clearcoat: 0.4, name: 'shieldPrev' });
  gilt ||= new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 1, roughness: 0.35, name: 'giltPrev' });
  const pelt = (set, color, sheen, name) => new THREE.MeshPhysicalMaterial({
    map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(1.0, 1.0), roughnessMap: set.ormMap, aoMap: set.ormMap, aoMapIntensity: 0.6,
    roughness: 1, metalness: 0, vertexColors: true, color: new THREE.Color(...color), envMapIntensity: 0.35,
    sheen: 0.4, sheenRoughness: 0.6, specularIntensity: 0.35, sheenColor: new THREE.Color(...sheen), name,
  });
  const boarPelt = peltTexture(T, { root: [0.035, 0.028, 0.022], mid: [0.17, 0.13, 0.1], tip: [0.55, 0.5, 0.44], tipAmt: 0.65, key: 'gameroom:peltBoar' });
  const stagPelt = peltTexture(T, { root: [0.045, 0.03, 0.02], mid: [0.25, 0.17, 0.1], tip: [0.52, 0.46, 0.38], tipAmt: 0.55, key: 'gameroom:peltStag2' });
  const leather = snoutLeatherTexture(T, { color: [0.16, 0.11, 0.1] });
  const strandB = hairStrandTexture(T, { root: [0.03, 0.025, 0.02], tip: [0.42, 0.39, 0.35], key: 'gameroom:strandBoar2' });
  const strandBr = hairStrandTexture(T, { root: [0.02, 0.016, 0.013], tip: [0.3, 0.27, 0.24], key: 'gameroom:strandBristle' });
  const strandS = hairStrandTexture(T, { root: [0.07, 0.042, 0.025], tip: [0.4, 0.29, 0.18], key: 'gameroom:strandStag2' });
  const card = (s, name) => new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.68, metalness: 0, vertexColors: true, envMapIntensity: 0.3, name });
  const eyeB = glassEyeTexture(T, { iris: [0.3, 0.17, 0.05], pupilW: 0.32, pupilH: 0.32, key: 'gameroom:eyeBoar' });
  const eyeS = glassEyeTexture(T, { iris: [0.17, 0.085, 0.03], pupilW: 0.5, pupilH: 0.22, key: 'gameroom:eyeStag2' });
  const eye = (t, name) => new THREE.MeshPhysicalMaterial({ map: t.map, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 1.6, name });
  const lid = new THREE.MeshPhysicalMaterial({ color: 0x0c0907, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, name: 'eyelid' });
  const snout = new THREE.MeshPhysicalMaterial({ map: leather.map, normalMap: leather.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: leather.ormMap, roughness: 0.9, vertexColors: true, color: new THREE.Color(1.15, 1.0, 0.95), clearcoat: 0.55, clearcoatRoughness: 0.25, name: 'boarSnout' });
  const nose = new THREE.MeshPhysicalMaterial({ map: leather.map, normalMap: leather.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughnessMap: leather.ormMap, roughness: 0.7, vertexColors: true, color: new THREE.Color(0.3, 0.26, 0.25), clearcoat: 0.9, clearcoatRoughness: 0.12, name: 'stagNose' });
  const tusk = new THREE.MeshPhysicalMaterial({ roughness: 0.32, vertexColors: true, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.7, name: 'tusk2' });
  const antler = new THREE.MeshStandardMaterial({ roughness: 0.82, vertexColors: true, envMapIntensity: 0.4, name: 'antler2' });
  const boarFur = pelt(boarPelt, [1.0, 0.95, 0.9], [0.32, 0.29, 0.26], 'boarPelt');
  const stagFur = pelt(stagPelt, [0.95, 0.88, 0.82], [0.42, 0.33, 0.24], 'stagPelt');
  const earB = boarFur.clone(); earB.side = THREE.DoubleSide; earB.name = 'boarEar';
  const earS = stagFur.clone(); earS.side = THREE.DoubleSide; earS.name = 'stagEar';
  return {
    boar: { shield, gilt, fur: boarFur, ear: earB, snout, eye: eye(eyeB, 'eyeBoar2'), lid, tusk, hair: card(strandB, 'boarHair2'), bristleCard: card(strandBr, 'boarBristle2') },
    stag: { shield, gilt, fur: stagFur, ear: earS, nose, eye: eye(eyeS, 'eyeStag3'), lid, antler, hair: card(strandS, 'stagHair2') },
  };
}
