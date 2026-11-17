// Escenario del menú y el garaje: un claro de selva con cielo, colinas, palmeras, banderines y focos.
import * as THREE from './vendor/three.module.min.js';
import { PROPS, merged } from './models.js';
import { SKY_FS } from './track.js';
import { addOutline } from './outline.js';

export function buildShowroom(scene) {
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const sunDir = new THREE.Vector3(-0.5, 0.6, 0.6).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, defines: { CLOUDS: 1 },
    uniforms: {
      top: { value: new THREE.Color(0x2a6bff) }, bottom: { value: new THREE.Color(0xffd0ee) }, dim: { value: 1 }, uTime: { value: 0 },
      uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(0xfff0c0) },
      uCloud: { value: new THREE.Color(0xffffff) }, uCloudShade: { value: new THREE.Color(0xc8b8ff) }, uCloudAmt: { value: 0.55 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: SKY_FS,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(260, 24, 14), skyMat));
  scene.fog = new THREE.Fog(0xffd8f0, 60, 230);

  // suelo con manchas de hierba
  const ground = new THREE.Mesh(new THREE.CircleGeometry(240, 48), new THREE.MeshLambertMaterial({ color: 0x4ad65a }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; scene.add(ground);
  const patchG = new THREE.CircleGeometry(1, 14), pm = [new THREE.MeshLambertMaterial({ color: 0x35c94a }), new THREE.MeshLambertMaterial({ color: 0x62e06e })];
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(patchG, pm[i % 2]); m.rotation.x = -Math.PI / 2; const a = rnd() * 6.28, r = 7 + rnd() * 70; m.position.set(Math.cos(a) * r, -0.48, Math.sin(a) * r - 20); m.scale.setScalar(3 + rnd() * 7); scene.add(m); }

  // colinas y montañas del fondo
  const hillM = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const hp = [];
  for (let i = 0; i < 16; i++) { const a = -2.9 + i * 0.36 + rnd() * 0.15, r = 70 + rnd() * 50, h = 14 + rnd() * 22; hp.push([new THREE.ConeGeometry(h * 1.5, h, 6, 1), i % 2 ? 0x3ac955 : 0x2aae4a, [Math.cos(a) * r, h / 2 - 1.5, Math.sin(a) * r - 10], null, [0, rnd() * 3, 0]]); }
  for (let i = 0; i < 12; i++) { const a = -2.8 + i * 0.46, r = 170 + rnd() * 30, h = 60 + rnd() * 50; hp.push([new THREE.ConeGeometry(h * 0.9, h, 6, 1), i % 2 ? 0x7fb8e8 : 0x9ac8f0, [Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r], null, [0, rnd() * 3, 0]]); }
  scene.add(new THREE.Mesh(merged(hp), hillM));

  // vegetación alrededor del escenario
  const veg = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const place = (type, x, z, s) => { const m = new THREE.Mesh(geos[type], veg); m.position.set(x, -0.5, z); m.scale.setScalar(s); m.rotation.y = rnd() * 6.28; scene.add(m); addOutline(m); };
  const geos = { palm: PROPS.palm.make(), tree: PROPS.tree.make(), rock: PROPS.rock.make(), mushroom: PROPS.mushroom.make(), flower: PROPS.flower.make() };
  for (const [x, z, s] of [[-13, -9, 1.3], [14, -12, 1.5], [-22, -20, 1.6], [24, -24, 1.4], [-8, -22, 1.2], [9, -26, 1.3]]) place('palm', x, z, s);
  for (const [x, z, s] of [[-18, -14, 1.2], [19, -17, 1.4], [0, -32, 1.8], [-30, -30, 1.7], [32, -32, 1.6]]) place('tree', x, z, s);
  for (const [x, z, s] of [[-9, -6, 1.1], [10.5, -7, 1.3], [-15, -3, 0.8]]) place('rock', x, z, s);
  for (const [x, z, s] of [[-7, -8, 1.4], [12, -4, 1.1]]) place('mushroom', x, z, s);
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = 5.5 + rnd() * 12; const m = new THREE.Mesh(geos.flower, veg); m.position.set(Math.cos(a) * r, -0.5, Math.sin(a) * r - 4); m.scale.setScalar(0.8 + rnd() * 0.8); scene.add(m); }

  // banderines y focos
  const cols = [0xff4fd8, 0xffd21f, 0x22e6ff, 0x35e08a, 0xff7a1a, 0x7a5cff], bp = [];
  for (const sx of [-11, 11]) bp.push([new THREE.CylinderGeometry(0.14, 0.18, 9, 6), 0xf0f0f0, [sx, 4, -5]]);
  for (let k = 0; k < 19; k++) { const u = k / 18, x = -11 + u * 22; bp.push([new THREE.ConeGeometry(0.5, 1.0, 3), cols[k % 6], [x, 8.1 - Math.sin(u * Math.PI) * 1.6, -5], [1, 1, 0.15], [0, 0, Math.PI]]); }
  scene.add(new THREE.Mesh(merged(bp), veg));
  const beams = [], bg = new THREE.ConeGeometry(3.2, 26, 14, 1, true); bg.translate(0, -13, 0);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: [0xffd21f, 0x22e6ff, 0xff4fd8][i], transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.position.set(-9 + i * 9, 17, -7); scene.add(m); beams.push(m); }

  return { update(t) { skyMat.uniforms.uTime.value = t; beams.forEach((b, i) => b.rotation.set(Math.sin(t * 0.8 + i * 1.9) * 0.3 + 0.2, 0, Math.cos(t * 0.6 + i * 2.3) * 0.35)); } };
}
