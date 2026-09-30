// -----------------------------------------
// DEPTH TOOL — makes depth maps in the browser, for the CMS
// -----------------------------------------
// Same model as tools/depth-map.mjs (Depth Anything V2 Small), but it runs in the visitor's browser.
// Webflow only serves this page. The model (~100 MB) downloads once and stays in the browser cache,
// the photo never leaves the computer.
//
// Markup:
//   <div data-depth-tool data-depth-tool-blur="4">
//     <label data-depth-tool-drop>
//       <input type="file" accept="image/*" data-depth-tool-input>
//     </label>
//     <p data-depth-tool-status></p>
//     <div data-depth-map>                          (live preview, uses depthMap.js)
//       <img data-depth-image>
//       <img data-depth-source>
//     </div>
//     <a data-depth-tool-download>Download</a>
//   </div>

import { initDepthMap } from "./depthMap";

// Loaded from the CDN only on this page, so the main bundle stays small
const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0";
const MODEL = "onnx-community/depth-anything-v2-small";

let estimateDepth = null; // The model, loaded once per visit

export function initDepthTool(container = document) {
  const tool = container.querySelector("[data-depth-tool]");
  if (!tool) return () => {};

  const drop = tool.querySelector("[data-depth-tool-drop]");
  const input = tool.querySelector("[data-depth-tool-input]");
  const status = tool.querySelector("[data-depth-tool-status]");
  const preview = tool.querySelector("[data-depth-map]");
  const previewImage = preview?.querySelector("[data-depth-image]");
  const previewSource = preview?.querySelector("[data-depth-source]");
  const download = tool.querySelector("[data-depth-tool-download]");

  const blur = parseFloat(tool.dataset.depthToolBlur) || 4;

  let busy = false;
  let urls = []; // Object URLs of the current result, freed on the next photo
  let previewCleanup = null;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  const setState = (state) => (tool.dataset.depthToolState = state); // idle | loading | done | error

  setState("idle");
  if (download) download.style.display = "none";

  async function run(file) {
    if (busy || !file?.type.startsWith("image/")) return;
    busy = true;
    setState("loading");

    try {
      if (!estimateDepth) {
        setStatus("Loading the model (only slow the first time)…");
        estimateDepth = await loadModel((percent) =>
          setStatus(`Loading the model… ${percent}%`),
        );
      }

      setStatus("Making the depth map…");
      const photoUrl = URL.createObjectURL(file);
      const { depth } = await estimateDepth(photoUrl);

      const blob = await toPng(depth, blur);
      const depthUrl = URL.createObjectURL(blob);

      // Free the previous result
      previewCleanup?.();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls = [photoUrl, depthUrl];

      if (download) {
        const name = file.name.replace(/\.[^.]+$/, "");
        download.href = depthUrl;
        download.download = `${name}-depth.png`;
        download.style.display = "";
      }

      // Live preview with the same effect as the site
      if (previewImage && previewSource) {
        previewSource.src = depthUrl;
        previewImage.src = photoUrl;
        await previewImage.decode(); // New photo loaded, so the preview measures the right size
        previewCleanup = initDepthMap(tool);
      }

      setStatus("Done! Download the depth map and upload it in the CMS.");
      setState("done");
    } catch (error) {
      console.error(error);
      setStatus("Something went wrong. Try another photo, or reload the page.");
      setState("error");
    }

    busy = false;
  }

  // --- Input: click to choose, or drag a photo onto the drop area
  const onChange = () => {
    run(input.files[0]);
    input.value = ""; // So the same photo can be chosen again
  };

  const onDragOver = (event) => {
    event.preventDefault();
    drop.dataset.depthToolDragging = "true";
  };

  const onDragLeave = () => delete drop.dataset.depthToolDragging;

  const onDrop = (event) => {
    event.preventDefault();
    onDragLeave();
    run(event.dataTransfer.files[0]);
  };

  input?.addEventListener("change", onChange);
  drop?.addEventListener("dragover", onDragOver);
  drop?.addEventListener("dragleave", onDragLeave);
  drop?.addEventListener("drop", onDrop);

  // Called by Barba before leaving the page
  return function cleanup() {
    input?.removeEventListener("change", onChange);
    drop?.removeEventListener("dragover", onDragOver);
    drop?.removeEventListener("dragleave", onDragLeave);
    drop?.removeEventListener("drop", onDrop);
    previewCleanup?.();
    urls.forEach((url) => URL.revokeObjectURL(url));
  };
}

// -----------------------------------------
// HELPERS
// -----------------------------------------

// Loads transformers.js + the model. WebGPU when the browser has it (fast), otherwise WebAssembly.
async function loadModel(onProgress) {
  const { pipeline } = await import(/* webpackIgnore: true */ TRANSFORMERS_URL);

  const files = {}; // Progress per model file, so the percentage covers the whole download
  const progress_callback = (event) => {
    if (event.status !== "progress") return;
    files[event.file] = event;
    const loaded = Object.values(files).reduce((sum, file) => sum + file.loaded, 0);
    const total = Object.values(files).reduce((sum, file) => sum + file.total, 0);
    onProgress(Math.round((loaded / total) * 100));
  };

  if (navigator.gpu) {
    try {
      return await pipeline("depth-estimation", MODEL, { device: "webgpu", progress_callback });
    } catch (error) {} // No usable GPU: fall back below
  }
  return pipeline("depth-estimation", MODEL, { progress_callback });
}

// Greyscale depth (white = near) → blurred PNG. Blur softens hard edges, so the effect doesn't tear.
function toPng(depth, radius) {
  const { width, height } = depth;
  const pixels = boxBlur(Uint8ClampedArray.from(depth.data), width, height, Math.round(radius));

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = pixels[i];
    rgba[i * 4 + 3] = 255;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// Three box blurs in a row look like a gaussian blur (canvas filter isn't reliable in Safari)
function boxBlur(pixels, width, height, radius) {
  if (radius < 1) return pixels;
  let a = pixels;
  let b = new Uint8ClampedArray(pixels.length);
  for (let pass = 0; pass < 3; pass++) {
    blurLine(a, b, width, height, radius, 1, width); // Horizontal
    blurLine(b, a, height, width, radius, width, 1); // Vertical
  }
  return a;
}

// Running average along every row (step 1) or column (step width)
function blurLine(from, to, length, lines, radius, step, lineStep) {
  const size = radius * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const start = line * lineStep;
    const at = (i) => from[start + Math.min(length - 1, Math.max(0, i)) * step];
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += at(i);
    for (let i = 0; i < length; i++) {
      to[start + i * step] = sum / size;
      sum += at(i + radius + 1) - at(i - radius);
    }
  }
}
