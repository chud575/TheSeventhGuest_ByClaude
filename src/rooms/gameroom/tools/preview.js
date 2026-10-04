// Isolated prop preview for the game room (dev only, not part of the build):
//   node src/rooms/gameroom/tools/pshot.mjs out.png "what=boar&yaw=0.6"
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as geometry from '../../../engine/geometry/index.js';
import { TextureForge } from '../../../engine/materials/TextureForge.js';
import { Random } from '../../../engine/core/Random.js';
const q = new URLSearchParams(location.search);
const what = q.get('what') || 'boar';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = +(q.get('exp') || 1);
r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0c1410);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;
const key = new THREE.SpotLight(0xffd8a8, 30, 8, 0.5, 0.6, 2); key.position.set(0.8, 1.6, 1.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
const rim = new THREE.DirectionalLight(0x9ab0ff, 0.8); rim.position.set(-2, 1, -0.5); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x405060, 0x302010, 0.4));
const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x1c3024, roughness: 0.9 })); wall.receiveShadow = true; scene.add(wall);
const cam = new THREE.PerspectiveCamera(+(q.get('fov') || 30), innerWidth / innerHeight, 0.01, 50);
const ctx = { THREE, renderer: r, geometry, textures: new TextureForge(r), random: new Random('gameroom:preview'), params: q };
ctx.forge = ctx.textures;
const t0 = performance.now();
const mod = await import(/* @vite-ignore */ './prev_' + what + '.js');
const { objs, view } = await mod.default(ctx, q);
const pivot = new THREE.Group(); scene.add(pivot);
for (const o of objs) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); pivot.add(o); }
const yaw = +(q.get('yaw') || 0), dist = +(q.get('dist') || view.dist || 1.6), pitch = +(q.get('pitch') || 0.1);
const tgt = new THREE.Vector3(...(q.get('target') ? q.get('target').split(',').map(Number) : (view.target || [0, 0, 0.25])));
cam.position.set(tgt.x + Math.sin(yaw) * dist * Math.cos(pitch), tgt.y + Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * dist * Math.cos(pitch));
cam.lookAt(tgt);
r.render(scene, cam);
window.__INFO = { ms: Math.round(performance.now() - t0) };
window.__READY = true;
