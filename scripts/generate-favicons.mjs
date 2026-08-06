import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, "..", "public", "favicon.svg");
const publicDir = path.join(__dirname, "..", "public");

const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(publicDir, "favicon-32x32.png"));
  await sharp(svgBuffer).resize(16, 16).png().toFile(path.join(publicDir, "favicon-16x16.png"));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("Generated favicon PNGs");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
