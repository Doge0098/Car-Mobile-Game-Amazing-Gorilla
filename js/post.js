// Resplandor (bloom) ligero: la escena se dibuja en HDR y lo que supera el blanco se difumina alrededor.
import * as THREE from './vendor/three.module.min.js';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const TAPS = `vec3 c = texture2D(tex, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, -1.0)).rgb
  + texture2D(tex, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tex, vUv + texel * vec2(1.0, 1.0)).rgb; c *= 0.25;`;
const DOWN_FS = `uniform sampler2D tex; uniform vec2 texel; uniform float thresh; varying vec2 vUv;
void main(){ ${TAPS}
  if (thresh > 0.0) { float b = max(c.r, max(c.g, c.b)); c *= max(0.0, b - thresh) / max(b, 0.0001); c = min(c, vec3(3.0)); }
  gl_FragColor = vec4(c, 1.0); }`;
const UP_FS = `uniform sampler2D tex; uniform sampler2D prev; uniform vec2 texel; varying vec2 vUv;
void main(){ ${TAPS} gl_FragColor = vec4(c + texture2D(prev, vUv).rgb, 1.0); }`;
const FINAL_FS = `uniform sampler2D tex; uniform sampler2D bloom; uniform float strength; varying vec2 vUv;
void main(){ vec3 c = texture2D(tex, vUv).rgb + texture2D(bloom, vUv).rgb * strength;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer; this.strength = 0.42; this.threshold = 1.0;
    const ext = renderer.extensions;
    this.supported = renderer.capabilities.isWebGL2 && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
    if (!this.supported) return;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.down = mk(DOWN_FS, { tex: { value: null }, texel: { value: new THREE.Vector2() }, thresh: { value: 0 } });
    this.up = mk(UP_FS, { tex: { value: null }, prev: { value: null }, texel: { value: new THREE.Vector2() } });
    this.final = mk(FINAL_FS, { tex: { value: null }, bloom: { value: null }, strength: { value: 1 } });
    this.rts = []; this.w = 0; this.h = 0; this.samples = 4;
  }

  setSize(samples = 4) {
    if (!this.supported) return;
    const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (sz.x === this.w && sz.y === this.h && samples === this.samples && this.sceneRT) return;
    this.w = sz.x; this.h = sz.y; this.samples = samples;
    this.disposeTargets();
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(sz.x, sz.y, { ...opt, depthBuffer: true, samples });
    // algunos móviles no admiten este tipo de búfer: se prueba sin suavizado y, si tampoco, se desactiva
    const gl = this.renderer.getContext(), complete = () => {
      this.renderer.setRenderTarget(this.sceneRT);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      this.renderer.setRenderTarget(null); return ok;
    };
    if (!complete() && samples > 0) { this.sceneRT.dispose(); this.sceneRT = new THREE.WebGLRenderTarget(sz.x, sz.y, { ...opt, depthBuffer: true }); }
    if (!complete()) { this.sceneRT.dispose(); this.sceneRT = null; this.supported = false; return; }
    // 4 niveles de reducción + 3 de ampliación
    let w = sz.x, h = sz.y;
    this.d = []; this.u = [];
    for (let i = 0; i < 4; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); this.d.push(new THREE.WebGLRenderTarget(w, h, opt)); if (i < 3) this.u.push(new THREE.WebGLRenderTarget(w, h, opt)); }
  }

  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.qScene, this.cam); }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.sceneRT) this.setSize(this.samples);
    if (!this.sceneRT) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.sceneRT); r.render(scene, camera);
    let src = this.sceneRT;
    for (let i = 0; i < 4; i++) {
      this.down.uniforms.tex.value = src.texture; this.down.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.down.uniforms.thresh.value = i === 0 ? this.threshold : 0;
      this.pass(this.down, this.d[i]); src = this.d[i];
    }
    for (let i = 2; i >= 0; i--) {
      this.up.uniforms.tex.value = src.texture; this.up.uniforms.texel.value.set(0.5 / src.width, 0.5 / src.height);
      this.up.uniforms.prev.value = this.d[i].texture;
      this.pass(this.up, this.u[i]); src = this.u[i];
    }
    this.final.uniforms.tex.value = this.sceneRT.texture; this.final.uniforms.bloom.value = src.texture; this.final.uniforms.strength.value = this.strength;
    this.pass(this.final, null);
  }

  disposeTargets() {
    if (this.sceneRT) this.sceneRT.dispose();
    for (const t of [...(this.d || []), ...(this.u || [])]) t.dispose();
    this.sceneRT = null;
  }
}
