import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Raycaster,
  RGBADepthPacking,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  TextureLoader,
  TubeGeometry,
  VSMShadowMap,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* The rail, as one imperative Three.js scene. React owns the controls and the
   piece sheet; this class owns pixels, physics and pointer input on the canvas,
   and reports back through callbacks. World units: one panel is ~1 wide. */

export interface RailSceneCallbacks {
  onIndex: (index: number) => void;
  /** A piece was clicked, or -1 when a drag put the picked piece back. */
  onPick: (index: number) => void;
  onColors: (colors: (string | null)[]) => void;
  onReady: () => void;
  onFail: () => void;
}

const SPACING = 1.22;
const RAIL_Y = 1.02;
const PANEL_W = 0.9;
const PANEL_TOP = -0.4; // below the pivot (the rail), where the clips grip
const KEYED_TOP = -0.2; // a keyed shirt's collar, just under the hook's neck
const VIEW_H = 2.85;
const VIEW_CY = 0.02;
const MIN_VIEW_W = 1.55; // a phone still shows one whole piece plus its gap

// Pendulum: natural period ~1.5 s, settles in ~3 s.
const SWING_K = 17;
const SWING_C = 1.5;
const SWING_DRIVE = 0.045;
const SWING_MAX = 0.32;

interface Piece {
  pivot: Group;
  panel: Mesh;
  uniforms: {
    uTime: { value: number };
    uBend: { value: number };
    uWind: { value: number };
    uSeed: { value: number };
  };
  hanger: Group;
  theta: number;
  omega: number;
}

/* Cloth displacement, shared by the colour and the shadow-depth pass so the
   shadow bends with the fabric. `p.y` runs 0 (clips) to -1 (hem). */
const CLOTH_GLSL = /* glsl */ `
uniform float uTime;
uniform float uBend;
uniform float uWind;
uniform float uSeed;
vec3 clothDisp(vec3 p) {
  float t = clamp(-p.y, 0.0, 1.0);
  float t2 = t * t;
  float ripple = sin(p.x * 5.0 + uTime * 1.6 + uSeed) * 0.55
               + sin(p.y * 6.5 - uTime * 1.15 + uSeed * 1.7) * 0.45;
  float edge = pow(abs(p.x) / 0.45, 2.0);
  vec3 d = vec3(uBend * t2 * 0.2, 0.0, 0.0);
  d.z = ripple * 0.03 * uWind * t
      + abs(uBend) * 0.1 * sin(p.x * 3.4 + uSeed) * t
      - 0.045 * edge * (0.35 + 0.65 * t);
  // A soft sag between the two clips along the top edge.
  d.y -= 0.018 * (1.0 - edge) * (1.0 - smoothstep(0.0, 0.12, t));
  return d;
}
`;

function patchCloth(shader: WebGLProgramParametersWithUniforms, uniforms: Piece['uniforms'], withNormals: boolean) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = CLOTH_GLSL + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    'vec3 transformed = position + clothDisp(position);'
  );
  if (withNormals) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `vec3 cA = position + clothDisp(position);
       vec3 cB = position + vec3(0.01, 0.0, 0.0) + clothDisp(position + vec3(0.01, 0.0, 0.0));
       vec3 cC = position + vec3(0.0, 0.01, 0.0) + clothDisp(position + vec3(0.0, 0.01, 0.0));
       vec3 objectNormal = normalize(cross(cB - cA, cC - cA));`
    );
  }
}

function tube(points: [number, number][], radius: number) {
  const curve = new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, 0)));
  return new TubeGeometry(curve, Math.max(24, points.length * 12), radius, 10, false);
}

interface PhotoRead {
  /** Swatch colour: the garment's own pixels when cut out, else the centre. */
  color: string | null;
  /** Garment silhouette as an alpha map, or null when there is no sweep. */
  mask: HTMLCanvasElement | null;
  /** Garment bounds in image space (0-1, y down). Whole image when uncut. */
  crop: { x: number; y: number; w: number; h: number };
}

const FULL = { x: 0, y: 0, w: 1, h: 1 };
const MASK_N = 192;

/* Product photos sit on a studio sweep. A flood fill from the border, with a
   small step tolerance, follows the sweep through its vignette and soft floor
   shadow but stops at the garment's edge. What is left is the garment. If the
   fill takes almost nothing or almost everything (a black tee on black), the
   photo is hung whole, with clips. */
function readPhoto(image: CanvasImageSource): PhotoRead {
  const N = MASK_N;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { color: null, mask: null, crop: FULL };
    ctx.drawImage(image, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;

    const bg = new Uint8Array(N * N);
    const queue = new Int32Array(N * N);
    let head = 0;
    let tail = 0;
    const seed = (p: number) => {
      if (!bg[p]) {
        bg[p] = 1;
        queue[tail++] = p;
      }
    };
    for (let k = 0; k < N; k++) {
      seed(k);
      seed((N - 1) * N + k);
      seed(k * N);
      seed(k * N + N - 1);
    }
    // The sweep's own tone, from the border pixels the fill starts on.
    let bgLum = 0;
    for (let k = 0; k < tail; k++) bgLum += lum(d, queue[k] * 4);
    bgLum /= tail;
    const STEP = 7;
    while (head < tail) {
      const p = queue[head++];
      const x = p % N;
      const y = (p - x) / N;
      const i = p * 4;
      for (const q of [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, y > 0 ? p - N : -1, y < N - 1 ? p + N : -1]) {
        if (q < 0 || bg[q]) continue;
        const j = q * 4;
        const diff = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
        // Soft floor shadows: neutral, a little darker than the sweep. The fill
        // may take bigger steps through them than through anything else.
        const l = lum(d, j);
        const shadow = chroma(d, j) < 22 && l < bgLum + 4 && l > bgLum - 70;
        if (diff < STEP || (shadow && diff < 28)) seed(q);
      }
    }

    // Shave one pixel off the garment edge: the sweep's warm fringe lives there.
    const edge: number[] = [];
    for (let p = 0; p < N * N; p++) {
      if (bg[p]) continue;
      const x = p % N;
      if ((x > 0 && bg[p - 1]) || (x < N - 1 && bg[p + 1]) || (p >= N && bg[p - N]) || (p < N * N - N && bg[p + N])) edge.push(p);
    }
    for (const p of edge) bg[p] = 1;

    let x0 = N, y0 = N, x1 = -1, y1 = -1, count = 0;
    const sum = [0, 0, 0];
    for (let p = 0; p < N * N; p++) {
      if (bg[p]) continue;
      const x = p % N;
      const y = (p - x) / N;
      count++;
      sum[0] += d[p * 4];
      sum[1] += d[p * 4 + 1];
      sum[2] += d[p * 4 + 2];
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    // A tee is a solid shape: it fills most of its own bounds. A print whose
    // white tee merged into a white sweep leaves scattered islands instead.
    const coverage = count / (N * N);
    const solidity = count / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (coverage < 0.12 || coverage > 0.8 || solidity < 0.45) return { color: centreColor(d, N), mask: null, crop: FULL };

    // White garment on black, softened by a pixel so the cut edge is clean.
    const out = ctx.createImageData(N, N);
    for (let p = 0; p < N * N; p++) {
      const v = bg[p] ? 0 : 255;
      out.data[p * 4] = out.data[p * 4 + 1] = out.data[p * 4 + 2] = v;
      out.data[p * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    const mask = document.createElement('canvas');
    mask.width = mask.height = N;
    const mctx = mask.getContext('2d');
    if (!mctx) return { color: centreColor(d, N), mask: null, crop: FULL };
    mctx.filter = 'blur(0.6px)';
    mctx.drawImage(canvas, 0, 0);

    const color = `rgb(${sum.map((v) => Math.round(v / count)).join(' ')})`;
    return { color, mask, crop: { x: x0 / N, y: y0 / N, w: (x1 - x0 + 1) / N, h: (y1 - y0 + 1) / N } };
  } catch {
    return { color: null, mask: null, crop: FULL };
  }
}

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
const chroma = (d: Uint8ClampedArray, i: number) =>
  Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);

function centreColor(d: Uint8ClampedArray, N: number): string {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = Math.floor(N * 0.3); y < N * 0.7; y++) {
    for (let x = Math.floor(N * 0.32); x < N * 0.68; x++) {
      const i = (y * N + x) * 4;
      sum[0] += d[i];
      sum[1] += d[i + 1];
      sum[2] += d[i + 2];
      count++;
    }
  }
  return `rgb(${sum.map((v) => Math.round(v / count)).join(' ')})`;
}

export class RailScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  private track = new Group();
  private pieces: Piece[] = [];
  private disposables: { dispose: () => void }[] = [];
  private raycaster = new Raycaster();
  private ndc = new Vector2();
  private shared: Record<'hanger' | 'steel', MeshStandardMaterial>;

  private offset = 0;
  private velocity = 0;
  private prevVelocity = 0;
  private target = 0;
  private mode: 'drag' | 'coast' | 'snap' = 'snap';
  private index = -1;
  private motion = true;
  private wind = 1;
  private bend = 0;
  private time = 0;

  private picked: number | null = null;
  private camShift = { x: 0, y: 0 };
  private camZoom = 1;

  private drag: { id: number; x: number; start: number; lastX: number; lastT: number; moved: boolean } | null = null;
  private hover = -1;
  private hoverX = 0;

  private raf = 0;
  private last = 0;
  private inView = true;
  private settled = 0;
  private readySent = false;
  private disposed = false;
  private colors: (string | null)[];
  private observers: { disconnect: () => void }[] = [];
  private key!: DirectionalLight;

  constructor(
    private host: HTMLElement,
    private textures: (string | null)[],
    private cb: RailSceneCallbacks,
    motion: boolean,
    start = 0
  ) {
    this.motion = motion;
    this.offset = this.target = start * SPACING;
    this.wind = motion ? 1 : 0;
    this.colors = textures.map(() => null);

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = 'rl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const pmrem = new PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.55;
    this.disposables.push(pmrem, env);

    this.camera.position.set(0, VIEW_CY, 10);
    this.buildLights();

    this.shared = {
      // The hanger takes the page's hanger ink, so it reads in both themes.
      hanger: new MeshStandardMaterial({
        color: new Color(getComputedStyle(host).getPropertyValue('--rl-hanger').trim() || '#2a2724'),
        roughness: 0.42,
        metalness: 0.05,
      }),
      steel: new MeshStandardMaterial({ color: new Color('#a4a39c'), roughness: 0.28, metalness: 0.9 }),
    };
    this.disposables.push(this.shared.hanger, this.shared.steel);

    this.buildRail();
    this.textures.forEach((url, i) => this.buildPiece(i, url));
    this.scene.add(this.track);

    this.bindInput();
    this.resize();
    this.render();

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      this.inView = entry.isIntersecting;
      this.kick();
    });
    io.observe(host);
    this.observers.push(ro, io);
    document.addEventListener('visibilitychange', this.kick);
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    // The canvas is revealed once the textures settle, or after 3 s regardless.
    window.setTimeout(() => this.sendReady(), 3000);
    this.kick();
  }

  // ---------- public API ----------

  goTo(i: number) {
    const clamped = Math.max(0, Math.min(this.pieces.length - 1, i));
    this.target = clamped * SPACING;
    this.mode = 'snap';
    if (!this.motion) {
      this.offset = this.target;
      this.velocity = 0;
    }
    this.kick();
  }

  setMotion(on: boolean) {
    this.motion = on;
    if (!on) {
      // Off means still now: no wind easing out for reduced-motion users.
      this.wind = 0;
      this.bend = 0;
      for (const p of this.pieces) {
        p.theta = 0;
        p.omega = 0;
      }
      this.offset = this.target;
      this.velocity = 0;
    }
    this.kick();
  }

  /** Zoom to a picked piece. `shift` is a fraction of the view to move it by. */
  setPicked(i: number | null, shift = { x: 0, y: 0 }) {
    this.picked = i;
    if (i !== null) this.goTo(i);
    this.camShift = i === null ? { x: 0, y: 0 } : shift;
    this.kick();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.observers.forEach((o) => o.disconnect());
    document.removeEventListener('visibilitychange', this.kick);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    canvas.removeEventListener('pointerleave', this.onLeave);
    this.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]) as Material[];
        mats.forEach((m) => {
          (m as MeshStandardMaterial).map?.dispose();
          (m as MeshStandardMaterial).alphaMap?.dispose();
          m.dispose();
        });
        (obj.customDepthMaterial as Material | undefined)?.dispose();
      }
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  // ---------- build ----------

  private buildLights() {
    this.scene.add(new HemisphereLight(0xfffaf0, 0x8a8577, 0.9));
    // One soft key from high front-left: the shadow falls short and down-right
    // and fades out, so it never reads as a second box behind the garment.
    const key = (this.key = new DirectionalLight(0xfff4e6, 2.1));
    key.position.set(-2.2, 5.2, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { top: 4, bottom: -4, near: 0.5, far: 20 }); // width: resize()
    key.shadow.bias = -0.0006;
    key.shadow.radius = 14;
    key.shadow.blurSamples = 20;
    this.scene.add(key);

    // The wall: invisible except for the shadows it catches, so the paper
    // behind the canvas is the page's own surface.
    const wallMat = new ShadowMaterial({ color: new Color('#2b2620'), opacity: 0.13 });
    const wall = new Mesh(new PlaneGeometry(60, 14), wallMat);
    wall.position.z = -0.42;
    wall.receiveShadow = true;
    this.scene.add(wall);
  }

  private buildRail() {
    const n = this.textures.length;
    const left = -SPACING * 0.9;
    const right = (n - 1) * SPACING + SPACING * 0.9;
    const len = right - left;
    const bar = new Mesh(new CylinderGeometry(0.024, 0.024, len, 24), this.shared.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(left + len / 2, RAIL_Y, 0);
    bar.castShadow = true;
    this.track.add(bar);
    // Wall brackets at both ends: a rounded cap and an arm back into the wall.
    for (const x of [left, right]) {
      const cap = new Mesh(new SphereGeometry(0.034, 20, 14), this.shared.steel);
      cap.position.set(x, RAIL_Y, 0);
      const arm = new Mesh(new CylinderGeometry(0.018, 0.018, 0.6, 16), this.shared.steel);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(x, RAIL_Y, -0.3);
      cap.castShadow = arm.castShadow = true;
      this.track.add(cap, arm);
    }
  }

  private buildPiece(i: number, url: string | null) {
    const pivot = new Group();
    pivot.position.set(i * SPACING, RAIL_Y, 0);

    // Hanger: hook over the rail, neck, curved shoulders, clip bar.
    const hanger = new Group();
    const hook = new Mesh(
      tube(
        [
          [0, -0.16],
          [0.004, -0.09],
          [0.03, -0.045],
          [0.044, 0.004],
          [0.024, 0.04],
          [-0.012, 0.043],
          [-0.04, 0.02],
          [-0.044, -0.012],
        ],
        0.0085
      ),
      this.shared.steel
    );
    const shoulders = new Mesh(
      tube(
        [
          [-0.47, -0.37],
          [-0.3, -0.27],
          [-0.12, -0.19],
          [0, -0.16],
          [0.12, -0.19],
          [0.3, -0.27],
          [0.47, -0.37],
        ],
        0.016
      ),
      this.shared.hanger
    );
    const bar = new Mesh(tube([[-0.47, -0.37], [0, -0.372], [0.47, -0.37]], 0.012), this.shared.hanger);
    bar.name = 'clipwork';
    hanger.add(shoulders, bar);
    for (const x of [-0.47, 0.47]) {
      const tip = new Mesh(new SphereGeometry(0.017, 14, 10), this.shared.hanger);
      tip.position.set(x, -0.37, 0);
      hanger.add(tip);
    }
    for (const x of [-0.34, 0.34]) {
      const clip = new Mesh(new BoxGeometry(0.06, 0.075, 0.034), this.shared.steel);
      clip.position.set(x, PANEL_TOP + 0.005, 0);
      clip.name = 'clipwork';
      hanger.add(clip);
    }
    pivot.add(hook, hanger);

    // The garment: a subdivided panel, pinned at the top edge, bent in the shader.
    const uniforms: Piece['uniforms'] = {
      uTime: { value: 0 },
      uBend: { value: 0 },
      uWind: { value: this.wind },
      uSeed: { value: i * 1.913 },
    };
    const geo = new PlaneGeometry(PANEL_W, 1, 18, 26);
    geo.translate(0, -0.5, 0);
    const mat = new MeshStandardMaterial({ color: new Color('#d9d6cb'), roughness: 0.9, metalness: 0, side: DoubleSide });
    mat.onBeforeCompile = (shader) => patchCloth(shader, uniforms, true);
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => patchCloth(shader, uniforms, false);
    const panel = new Mesh(geo, mat);
    panel.customDepthMaterial = depth;
    panel.position.y = PANEL_TOP;
    panel.scale.y = PANEL_W * 1.15;
    panel.userData.index = i;
    pivot.traverse((o) => (o.castShadow = true));
    panel.castShadow = true;
    pivot.add(panel);
    this.track.add(pivot);

    this.pieces.push({ pivot, panel, hanger, uniforms, theta: 0, omega: 0 });

    if (!url) {
      this.settleOne();
      return;
    }
    new TextureLoader().setCrossOrigin('anonymous').load(
      url,
      (tex: Texture) => {
        if (this.disposed) {
          tex.dispose();
          return;
        }
        const img = tex.image as HTMLImageElement;
        const read = readPhoto(img);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        // Crop to the garment; texture v runs bottom-up.
        tex.repeat.set(read.crop.w, read.crop.h);
        tex.offset.set(read.crop.x, 1 - read.crop.y - read.crop.h);
        mat.map = tex;
        mat.color.set('#ffffff');
        const aspect = (read.crop.h * img.height) / (read.crop.w * img.width) || 1.15;
        panel.scale.y = PANEL_W * Math.min(1.45, Math.max(0.8, aspect));
        if (read.mask) {
          // A garment on a hanger: no clips, the neck shows above the collar,
          // the shoulders sit inside the shirt.
          const alpha = new CanvasTexture(read.mask);
          alpha.repeat.copy(tex.repeat);
          alpha.offset.copy(tex.offset);
          mat.alphaMap = alpha;
          mat.alphaTest = 0.5;
          mat.alphaToCoverage = true;
          depth.alphaMap = alpha;
          depth.alphaTest = 0.5;
          panel.position.set(0, KEYED_TOP, 0.03);
          hanger.scale.x = 0.7;
          hanger.children.forEach((c) => (c.visible = c.name !== 'clipwork'));
        }
        mat.needsUpdate = true;
        depth.needsUpdate = true;
        this.colors[i] = read.color;
        this.cb.onColors([...this.colors]);
        this.settleOne();
        this.kick();
      },
      undefined,
      () => this.settleOne()
    );
  }

  private settleOne() {
    this.settled += 1;
    if (this.settled >= this.textures.length) this.sendReady();
  }

  private sendReady() {
    if (this.readySent || this.disposed) return;
    this.readySent = true;
    this.render();
    this.cb.onReady();
  }

  // ---------- input ----------

  private bindInput() {
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
  }

  private worldPerPx() {
    const w = this.renderer.domElement.clientWidth || 1;
    return (this.camera.right - this.camera.left) / this.camera.zoom / w;
  }

  private pickAt(e: PointerEvent): number {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.pieces.map((p) => p.panel), false)[0];
    return hit ? (hit.object.userData.index as number) : -1;
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.drag = { id: e.pointerId, x: e.clientX, start: this.offset, lastX: e.clientX, lastT: performance.now(), moved: false };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.mode = 'drag';
    this.velocity = 0;
    this.renderer.domElement.style.cursor = 'grabbing';
    this.kick();
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) {
      const dx = e.clientX - this.drag.x;
      if (Math.abs(dx) > 6 && !this.drag.moved) {
        this.drag.moved = true;
        // Dragging the rail puts the picked piece back.
        if (this.picked !== null) {
          this.setPicked(null);
          this.cb.onPick(-1);
        }
      }
      const max = (this.pieces.length - 1) * SPACING;
      let next = this.drag.start - dx * this.worldPerPx();
      // Rubber band past either end.
      if (next < 0) next *= 0.35;
      else if (next > max) next = max + (next - max) * 0.35;
      const now = performance.now();
      const dt = Math.max(1, now - this.drag.lastT) / 1000;
      const v = -(e.clientX - this.drag.lastX) * this.worldPerPx() / dt;
      this.velocity = this.velocity * 0.6 + v * 0.4;
      this.drag.lastX = e.clientX;
      this.drag.lastT = now;
      this.offset = next;
      this.kick();
      return;
    }
    const i = this.pickAt(e);
    if (i !== this.hover) {
      // Brushing past a garment nudges it the way the pointer travels.
      if (i >= 0 && this.motion) this.pieces[i].omega += Math.sign(e.clientX - this.hoverX || 1) * 0.55;
      this.hover = i;
      this.renderer.domElement.style.cursor = i >= 0 ? 'pointer' : 'grab';
      this.kick();
    }
    this.hoverX = e.clientX;
  };

  private onUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const { moved, lastT } = this.drag;
    this.drag = null;
    // Held still before letting go: no fling from the last movement.
    if (performance.now() - lastT > 90) this.velocity = 0;
    this.renderer.domElement.style.cursor = this.hover >= 0 ? 'pointer' : 'grab';
    if (!moved && e.type === 'pointerup') {
      const i = this.pickAt(e);
      this.mode = 'snap';
      if (i >= 0) this.cb.onPick(i);
      else this.goTo(Math.round(this.offset / SPACING));
      return;
    }
    this.mode = this.motion ? 'coast' : 'snap';
    if (!this.motion) this.goTo(Math.round(this.offset / SPACING));
    this.kick();
  };

  private onLeave = () => {
    if (this.drag) return;
    this.hover = -1;
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cb.onFail();
  };

  // ---------- loop ----------

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewH = Math.max(VIEW_H, MIN_VIEW_W / aspect);
    const viewW = viewH * aspect;
    Object.assign(this.camera, { left: -viewW / 2, right: viewW / 2, top: viewH / 2, bottom: -viewH / 2 });
    this.camera.updateProjectionMatrix();
    // Shadows must cover the whole view, however wide the screen is.
    const shadowCam = this.key.shadow.camera;
    shadowCam.left = -viewW / 2 - 1.5;
    shadowCam.right = viewW / 2 + 1.5;
    shadowCam.updateProjectionMatrix();
    this.render();
  }

  /** Start the loop if it is idle and there is a reason to draw. */
  private kick = () => {
    if (this.raf || this.disposed || document.hidden || !this.inView) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private frame = () => {
    this.raf = 0;
    // The rAF timestamp can predate the kick that scheduled it, which would
    // give a negative first step; read the clock here and clamp both ends.
    const now = performance.now();
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    const busy = this.step(dt);
    this.render();
    if (busy && !document.hidden && this.inView) this.raf = requestAnimationFrame(this.frame);
  };

  /** Advance the physics. Returns false once everything is at rest. */
  private step(dt: number): boolean {
    const n = this.pieces.length;
    const max = (n - 1) * SPACING;
    this.prevVelocity = this.velocity;

    if (this.mode === 'coast') {
      this.offset += this.velocity * dt;
      this.velocity *= Math.exp(-3.2 * dt);
      if (this.offset < 0 || this.offset > max || Math.abs(this.velocity) < 0.7) {
        this.target = Math.max(0, Math.min(max, Math.round(this.offset / SPACING) * SPACING));
        this.mode = 'snap';
      }
    } else if (this.mode === 'snap') {
      if (this.motion) {
        const k = 70;
        const c = 2 * Math.sqrt(k) * 0.82;
        this.velocity += (k * (this.target - this.offset) - c * this.velocity) * dt;
        this.offset += this.velocity * dt;
        if (Math.abs(this.target - this.offset) < 0.0005 && Math.abs(this.velocity) < 0.003) {
          this.offset = this.target;
          this.velocity = 0;
        }
      } else {
        this.offset = this.target;
        this.velocity = 0;
      }
    }

    const idx = Math.max(0, Math.min(n - 1, Math.round(this.offset / SPACING)));
    if (idx !== this.index) {
      this.index = idx;
      this.cb.onIndex(idx);
    }

    // Wind eases in and out with the motion toggle instead of popping.
    this.wind += ((this.motion ? 1 : 0) - this.wind) * (1 - Math.exp(-dt * 3));
    this.time += dt * this.wind;
    const accel = dt > 0 ? (this.velocity - this.prevVelocity) / dt : 0;
    const bendTarget = this.motion ? Math.max(-0.55, Math.min(0.55, this.velocity * 0.13)) : 0;
    this.bend += (bendTarget - this.bend) * (1 - Math.exp(-dt * 6));

    let moving = this.mode !== 'snap' || this.velocity !== 0 || this.drag !== null;
    for (const p of this.pieces) {
      if (this.motion) {
        const idle = Math.sin(this.time * 0.7 + p.uniforms.uSeed.value) * 0.012;
        const a = -SWING_K * (p.theta - idle) - SWING_C * p.omega + accel * SWING_DRIVE;
        p.omega += a * dt;
        p.theta = Math.max(-SWING_MAX, Math.min(SWING_MAX, p.theta + p.omega * dt));
      } else {
        p.theta += (0 - p.theta) * (1 - Math.exp(-dt * 10));
        p.omega = 0;
      }
      p.pivot.rotation.z = p.theta;
      p.uniforms.uTime.value = this.time;
      p.uniforms.uBend.value = this.bend - p.theta * 0.8;
      p.uniforms.uWind.value = this.wind;
      if (Math.abs(p.omega) > 0.002) moving = true;
    }
    this.track.position.x = -this.offset;

    // Camera follows the pick: zoom in and slide the piece clear of the sheet.
    const viewW = this.camera.right - this.camera.left;
    const zoomTarget = this.picked === null ? 1 : 1.25;
    const xTarget = (this.camShift.x * viewW) / zoomTarget;
    // Picked: centre on the garment, from the hook to the hem.
    const focus = this.picked === null ? null : this.pieces[this.picked]?.panel;
    const centreY = focus ? (RAIL_Y + 0.06 + RAIL_Y + focus.position.y - focus.scale.y) / 2 : VIEW_CY;
    const yTarget = centreY + (this.camShift.y * (this.camera.top - this.camera.bottom)) / zoomTarget;
    const ease = this.motion ? 1 - Math.exp(-dt * 5) : 1;
    this.camZoom += (zoomTarget - this.camZoom) * ease;
    this.camera.position.x += (xTarget - this.camera.position.x) * ease;
    this.camera.position.y += (yTarget - this.camera.position.y) * ease;
    if (Math.abs(this.camZoom - this.camera.zoom) > 1e-5) {
      this.camera.zoom = this.camZoom;
      this.camera.updateProjectionMatrix();
    }
    if (
      Math.abs(zoomTarget - this.camZoom) > 0.001 ||
      Math.abs(xTarget - this.camera.position.x) > 0.001 ||
      Math.abs(yTarget - this.camera.position.y) > 0.001
    ) {
      moving = true;
    }
    // Wind keeps the cloth alive while motion is on; off, the loop can rest.
    return moving || this.wind > 0.01;
  }

  private render() {
    this.track.position.x = -this.offset;
    this.renderer.render(this.scene, this.camera);
  }
}
