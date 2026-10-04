import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { knightGeometry } from '../../../src/engine/lib/contrib/bedroom-knight.js';
const q = new URLSearchParams(location.search);
const what = q.get('what') || 'knight';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x202024);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
const key = new THREE.DirectionalLight(0xfff0dd, 2.5); key.position.set(2, 3, 2); scene.add(key);
const rim = new THREE.DirectionalLight(0x99aaff, 1.5); rim.position.set(-2, 1, -2); scene.add(rim);
const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 50);
const mods = await import(/* @vite-ignore */ q.get('mod') || './prev_' + what + '.js');
const { objs, view } = await mods.default(THREE, r);
let x = 0; for (const o of objs) { scene.add(o); }
cam.position.set(...view.pos); cam.lookAt(new THREE.Vector3(...view.target));
r.render(scene, cam);
window.__READY = true;
