// Contorno estilo cómic: se dibuja una segunda copia de cada modelo, vista por detrás y ensanchada en pantalla.
import * as THREE from './vendor/three.module.min.js';

const uRes = { value: new THREE.Vector2(1280, 720) }, uPx = { value: 2.4 };

export const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a0b3a, side: THREE.BackSide });
outlineMat.onBeforeCompile = sh => {
  sh.uniforms.uRes = uRes; sh.uniforms.uPx = uPx;
  sh.vertexShader = 'attribute vec3 oNormal; uniform vec2 uRes; uniform float uPx;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    vec4 oN = vec4(oNormal, 0.0);
    #ifdef USE_INSTANCING
      oN = instanceMatrix * oN;
    #endif
    vec4 oC = projectionMatrix * modelViewMatrix * oN;
    float oW = uPx * mix(0.4, 1.0, clamp(10.0 / gl_Position.w, 0.0, 1.0));
    gl_Position.xy += normalize(oC.xy + vec2(1e-5)) * oW * gl_Position.w * 2.0 / uRes;`);
};

export function setOutline(on) { outlineMat.visible = !!on; }
export function setOutlineRes(w, h) { uRes.value.set(w, h); uPx.value = Math.max(1.6, h / 290); }

// Normales suavizadas por posición: evitan que el contorno se abra en las aristas duras.
export function smoothNormals(geo) {
  if (geo.attributes.oNormal) return geo;
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map(), out = new Float32Array(p.count * 3), keys = new Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 400) + ',' + Math.round(p.getY(i) * 400) + ',' + Math.round(p.getZ(i) * 400); keys[i] = k;
    let v = map.get(k); if (!v) { v = [0, 0, 0]; map.set(k, v); }
    v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i);
  }
  for (let i = 0; i < p.count; i++) { const v = map.get(keys[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; out[i * 3] = v[0] / l; out[i * 3 + 1] = v[1] / l; out[i * 3 + 2] = v[2] / l; }
  geo.setAttribute('oNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

// Añade el contorno a una malla (como hija, comparte su transformación).
export function addOutline(mesh) {
  smoothNormals(mesh.geometry);
  const o = new THREE.Mesh(mesh.geometry, outlineMat); o.userData.isOutline = true; mesh.add(o); return o;
}

// Contorno para una malla instanciada: comparte las matrices de las instancias.
export function outlineInstanced(im) {
  smoothNormals(im.geometry);
  const o = new THREE.InstancedMesh(im.geometry, outlineMat, im.count);
  o.instanceMatrix = im.instanceMatrix; o.count = im.count; o.frustumCulled = false; o.userData.isOutline = true;
  return o;
}
