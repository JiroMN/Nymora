// -----------------------------------------
// DEPTH MAP GENERATOR
// -----------------------------------------
// Makes a depth map for the depth effect on the site: white = near, black = far.
// Uses Depth Anything V2 Small (Apache 2.0, fine for client work) and runs on this Mac.
//
// Usage:
//   npm run depth -- photo.png
//   npm run depth -- photo1.png photo2.jpg        (several at once)
//   npm run depth -- photo.png --blur 6           (softer edges, default 4)
//
// Saves "<name>-depth.png" next to each photo, same size as the photo.

import path from "node:path";
import sharp from "sharp";
import { pipeline } from "@huggingface/transformers";

// --- Read the command: photos + optional --blur
const args = process.argv.slice(2);
const blurFlag = args.indexOf("--blur");
const blur = blurFlag >= 0 ? Number(args[blurFlag + 1]) : 4;
const photos =
  blurFlag >= 0 ? args.filter((arg, i) => i !== blurFlag && i !== blurFlag + 1) : args;

if (!photos.length) {
  console.log("Usage: npm run depth -- photo.png [more photos] [--blur 4]");
  process.exit(1);
}

// --- Load the model once (downloads the first time, then it's cached)
const estimateDepth = await pipeline(
  "depth-estimation",
  "onnx-community/depth-anything-v2-small",
);

for (const photo of photos) {
  const { depth } = await estimateDepth(path.resolve(photo));

  const { dir, name } = path.parse(photo);
  const output = path.join(dir, `${name}-depth.png`);

  // Blur softens hard edges, so the effect doesn't tear around the subject
  let image = sharp(Buffer.from(depth.data), {
    raw: { width: depth.width, height: depth.height, channels: 1 },
  });
  if (blur > 0) image = image.blur(blur);

  await image.png().toFile(output);
  console.log(`✓ ${output}`);
}
