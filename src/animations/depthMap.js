// -----------------------------------------
// DEPTH MAP (fake 3D) — based on akella/fake3d
// -----------------------------------------
// A photo plus a greyscale depth map (white = near, black = far), drawn in WebGL.
// Mouse, touch or gyro shift every pixel by its depth: the foreground moves more than the background.
//
// Markup:
//   <div data-depth-map data-depth-strength-x="0.03" data-depth-strength-x-custom="{CMS}" ...>
//     <img data-depth-image src="photo.jpg">
//     <img data-depth-source src="depth.jpg">   (hidden by this script)
//   </div>
//
// Every setting has a default attribute and a "-custom" twin for the CMS.
// A filled custom value wins, an empty one counts as "not set".

const VERTEX_SHADER = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uRes;
  uniform vec2 uImageSize;
  uniform vec2 uMouse;
  uniform vec2 uStrength;
  uniform float uFocus;
  uniform float uZoom;
  varying vec2 vUv;

  void main() {
    // Same framing as object-fit: cover
    float rs = uRes.x / uRes.y;
    float ri = uImageSize.x / uImageSize.y;
    vec2 scale = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
    vec2 uv = (vUv - 0.5) * scale / uZoom + 0.5;

    // Shift every pixel by its depth, pixels at the focus depth stand still
    float depth = texture2D(uDepth, uv).r;
    vec2 offset = uMouse * (depth - uFocus) * uStrength;
    gl_FragColor = texture2D(uImage, uv + offset);
  }`;

// -----------------------------------------
// GYRO (one for the whole site, shared by every depth map)
// -----------------------------------------

const gyro = { active: false, base: null, listeners: new Set() };

function onDeviceOrientation(event) {
  if (event.beta == null || event.gamma == null) return;

  let beta = event.beta;
  let gamma = event.gamma;

  // Correct for landscape
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  if (angle === 90) [beta, gamma] = [-gamma, beta];
  if (angle === -90 || angle === 270) [beta, gamma] = [gamma, -beta];

  // The first reading is the zero point, after that it slowly follows how the phone is held
  if (!gyro.base) gyro.base = { beta, gamma };
  gyro.base.beta += (beta - gyro.base.beta) * 0.004;
  gyro.base.gamma += (gamma - gyro.base.gamma) * 0.004;

  const range = 20; // degrees of tilt for full movement
  const x = (gamma - gyro.base.gamma) / range;
  const y = (beta - gyro.base.beta) / range;

  gyro.listeners.forEach((fn) => fn(x, y));
}

// iOS only allows this from a tap or click
async function enableGyro() {
  if (gyro.active) return;
  if (typeof DeviceOrientationEvent === "undefined") return;

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") return;
    } catch (error) {
      return;
    }
  }

  window.addEventListener("deviceorientation", onDeviceOrientation);
  gyro.active = true;
}

// -----------------------------------------
// INIT
// -----------------------------------------

export function initDepthMap(container = document, lenis = null) {
  const elements = container.querySelectorAll("[data-depth-map]");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // The photo stays as it is
  if (!elements.length || reducedMotion) return () => {};

  const cleanups = [];

  // Gyro: iOS asks permission after a tap, Android starts right away
  container.querySelectorAll("[data-depth-gyro-button]").forEach((button) => {
    button.addEventListener("click", enableGyro);
    cleanups.push(() => button.removeEventListener("click", enableGyro));
  });

  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const needsPermission =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function";
  if (isTouch && !needsPermission) enableGyro();

  elements.forEach((el) => {
    const cleanup = createDepthMap(el, lenis);
    if (cleanup) cleanups.push(cleanup);
  });

  // Called by Barba before leaving the page
  return function cleanup() {
    cleanups.forEach((fn) => fn());
  };
}

// -----------------------------------------
// ONE DEPTH MAP
// -----------------------------------------

function createDepthMap(el, lenis) {
  const imageEl = el.querySelector("[data-depth-image]");
  const sourceEl = el.querySelector("[data-depth-source]");

  // No depth map: the photo stays
  if (!imageEl || !sourceEl || !sourceEl.getAttribute("src")) return;

  sourceEl.style.display = "none";

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false });

  // No WebGL: the photo stays
  if (!gl) return;

  canvas.setAttribute("aria-hidden", "true");
  gsap.set(canvas, { position: "absolute", top: 0, left: 0, visibility: "hidden" });
  imageEl.after(canvas); // Right after the photo, so the overlay (z-index: 1) stays on top

  // --- Settings: custom (CMS) value wins over the default, an empty string counts as "not set"
  const read = (key, fallback) => {
    const value = el.dataset[key + "Custom"] || el.dataset[key];
    const number = parseFloat(value);
    return Number.isNaN(number) ? fallback : number;
  };

  const settings = {
    strengthX: read("depthStrengthX", 0.03),
    strengthY: read("depthStrengthY", 0.02),
    focus: read("depthFocus", 0.5),
    smoothing: read("depthSmoothing", 0.8),
    zoom: read("depthZoom", 1.06),
  };

  // --- WebGL setup
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  gl.useProgram(program);

  // One quad that fills the canvas
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name) => gl.getUniformLocation(program, name);
  gl.uniform1i(uniform("uImage"), 0);
  gl.uniform1i(uniform("uDepth"), 1);
  gl.uniform2f(uniform("uStrength"), settings.strengthX, settings.strengthY);
  gl.uniform1f(uniform("uFocus"), settings.focus);
  gl.uniform1f(uniform("uZoom"), settings.zoom);
  const uRes = uniform("uRes");
  const uImageSize = uniform("uImageSize");
  const uMouse = uniform("uMouse");

  // --- Textures: unit 0 is the photo, unit 1 is the depth map
  const upload = (unit, image) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  };

  let ready = false;
  let inView = true;
  const state = { x: 0, y: 0, scrollY: 0, source: "none", lastInput: 0 };
  const drawn = { x: null, y: null }; // Last drawn position, so idle frames cost nothing

  // --- Render
  const render = () => {
    if (!ready || !inView) return;
    const y = state.y + state.scrollY; // Mouse/gyro plus the scroll push
    if (state.x === drawn.x && y === drawn.y) return;
    drawn.x = state.x;
    drawn.y = y;
    gl.uniform2f(uMouse, state.x, -y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  gsap.ticker.add(render);

  // --- Size: the canvas copies the photo's box, so both frame the image the same way
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = imageEl.offsetWidth;
    const height = imageEl.offsetHeight;
    gsap.set(canvas, { width, height });
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    drawn.x = null; // Resizing wipes the canvas, so draw again right away
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(imageEl);

  // --- Only draw while on screen
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
  });
  intersectionObserver.observe(el);

  // --- Load both images, then swap the photo for the canvas
  Promise.all([waitForImage(imageEl), loadCorsImage(sourceEl.src)])
    .then(([photoSrc, depth]) => loadCorsImage(photoSrc).then((photo) => [photo, depth]))
    .then(([photo, depth]) => {
      upload(0, photo);
      upload(1, depth);
      gl.uniform2f(uImageSize, photo.naturalWidth, photo.naturalHeight);
      ready = true;
      render();
      gsap.set(canvas, { visibility: "visible" });
      gsap.set(imageEl, { visibility: "hidden" });
    })
    .catch(() => {}); // Load failed: the photo stays

  // --- Smoothing
  const xTo = gsap.quickTo(state, "x", { duration: settings.smoothing, ease: "power3.out" });
  const yTo = gsap.quickTo(state, "y", { duration: settings.smoothing, ease: "power3.out" });
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  // Scroll: faster scrolling pushes the depth vertically (velocity carries the direction), stopping eases it back
  const scrollTo = gsap.quickTo(state, "scrollY", { duration: settings.smoothing, ease: "power3.out" });
  const offScroll = lenis?.on("scroll", ({ velocity }) => scrollTo(clamp(velocity / 10)));

  const setTarget = (x, y, source) => {
    state.source = source;
    state.lastInput = performance.now();
    xTo(clamp(x));
    yTo(clamp(y));
  };

  // --- Input: mouse across the viewport, touch across the element, gyro from the shared sensor
  const gyroRecent = () =>
    state.source === "gyro" && performance.now() - state.lastInput < 500;

  const onMouseMove = (event) => {
    if (event.pointerType !== "mouse") return;
    setTarget(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1,
      "mouse",
    );
  };

  const onTouchMove = (event) => {
    if (event.pointerType === "mouse" || gyroRecent()) return;
    const rect = el.getBoundingClientRect();
    setTarget(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1,
      "touch",
    );
  };

  const onTouchEnd = (event) => {
    if (event.pointerType !== "mouse" && state.source === "touch") setTarget(0, 0, "touch");
  };

  const onGyro = (x, y) => setTarget(x, y, "gyro");

  window.addEventListener("pointermove", onMouseMove, { passive: true });
  el.addEventListener("pointermove", onTouchMove, { passive: true });
  el.addEventListener("pointerup", onTouchEnd);
  el.addEventListener("pointercancel", onTouchEnd);
  gyro.listeners.add(onGyro);

  return function cleanup() {
    gsap.ticker.remove(render);
    gsap.killTweensOf(state);
    window.removeEventListener("pointermove", onMouseMove);
    el.removeEventListener("pointermove", onTouchMove);
    el.removeEventListener("pointerup", onTouchEnd);
    el.removeEventListener("pointercancel", onTouchEnd);
    gyro.listeners.delete(onGyro);
    offScroll?.();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    gsap.set(imageEl, { clearProps: "visibility" });
  };
}

// -----------------------------------------
// HELPERS
// -----------------------------------------

// Resolves with the source the browser picked for the photo (srcset), once it has loaded.
// Lazy images load late, so far-down items also get their textures late: free lazy loading.
function waitForImage(img) {
  return new Promise((resolve, reject) => {
    const src = () => img.currentSrc || img.src;
    if (img.naturalWidth) return resolve(src());
    img.addEventListener("load", () => resolve(src()), { once: true });
    img.addEventListener("error", reject, { once: true });
  });
}

// WebGL needs a CORS-enabled image. Same URL, so the browser serves it from cache.
function loadCorsImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
