import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const LOGO_DIR = path.join(PUBLIC_DIR, "images", "logo");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");

fs.mkdirSync(LOGO_DIR, { recursive: true });
fs.mkdirSync(ICONS_DIR, { recursive: true });

// The emblem paths (crown, flowing hair, star) extracted from the official SVG
const EMBLEM_PATHS = `
  <path d="M377.69,400.32c-41.23,2.48-82.19,8.13-122.64,17.67,17.34-7.97,35.24-13.12,53.83-17.61,20.52-4.95,40.64-7.83,61.61-10.41l53.02-6.54c10.84-1.34,20.98-3.86,31.11-7.74,9.43-3.61,17.97-8.65,24.75-15.98,14.87-16.07,12.72-37.3-3.4-51.62-9.02-8.01-19.61-13.23-31.35-16.53-27.3-7.67-55.2-6.02-82.75,2.02,12.2-7.16,25.42-11.57,39.19-14.16l26.26-4.94c9.13-1.72,17.78-4.26,26.17-8.07,11.03-5.02,22.22-14.27,21.98-26.56-.15-7.44-3.15-14.31-7.76-20.01l-17.41-21.48c-16.68-20.58-28.17-53.88-13.51-78.21-.65,9.17-.18,16.75,2.8,24.84,8.8,23.88,27.79,40.7,45.88,57.73l18.04,16.98c3.95,3.72,7.35,8.02,9.78,12.79,5.34,10.47,2.53,22.24-6.43,29.66-16.12,13.34-41.53,15.19-62.61,16.69l27.88,3.87c22.14,5.08,46.69,15.91,57.66,36.38,7.14,13.44,6.03,29.06-2.9,41.49-7.83,10.91-19.25,17.73-32.16,21.71,28.81,1.12,57.1,3.57,81.41,18.69,7.51,4.67,13.7,10.34,18.75,17.84-14.69-5.48-28.96-8.94-44.27-11.73-25.9-4.72-51.58-6.91-77.95-8.1-31.88-1.45-63.14-.59-94.99,1.32Z" />
  <path d="M214.71,233.02c26.46,32.61,40.85,69.51,42.84,110.72.74,15.43-.68,30.48-4.2,45.65-4.35-24.46-10.99-46.77-20.35-69.02-17.29-41.64-45.09-82.96-84.64-107.22,55.51-22.47,118.31-9.03,156.52,36.6,5.25,6.27,9.15,12.62,12.63,20.14,2.54-28.8,16.31-44.73,35.38-63.95l25.16-25.35c14.8-14.91,29.43-39.03,25.78-60.89,13.14,21.55,7.61,46.76-4.31,68.11-5.91,10.59-13.02,19.84-20.34,29.51l-20.66,27.31c-19.78,26.14-25.65,60.42-24.94,93.43l-5.24-12.59c-5.14-12.34-8.11-24.64-12.04-37.4-3.68-11.93-12.52-21.75-22.06-29.5-21.85-17.74-51.55-26.11-79.51-25.56Z" />
  <path d="M610.31,253.14l15.22-20.19c-34.89-.52-68.1,11.77-93.65,34.59-7.27,6.5-12.95,13.43-19.02,21.26-.39-6.91,2.35-12.63,5.21-18.17,13.19-25.54,39.67-47,65.93-58.38,14.32-6.2,28.91-9.55,44.54-9.99,21.96-.62,43.37,2.61,64.02,10.87-13.82,8.51-25.19,18.2-35.97,29.56-14.4,15.43-26.34,32.34-36.62,50.86-16.58,30.74-28.01,63.28-34.59,98.15-10.26-49.66-2.25-95.23,24.93-138.55Z" />
  <path d="M330.19,380.51c-32.61,6.36-61.64,15.12-90.16,32.57,8.91-14.73,21.38-25.61,35.7-34.22,34.02-19.77,74.15-23.54,113.02-19.88,17.06,2.2,33.38,4.84,49.82,9.71l-39.48,3.31c-23.24,1.85-45.56,4.49-68.89,8.51Z" />
  <path d="M470.74,85.49c-26.75,4.52-44.92,20.19-50.03,47.1-2.51-12.36-7.98-23.7-17.44-32.25-9.21-8.19-19.73-12.58-32.52-14.94,26.42-3.63,45.98-22.57,49.94-49.35,2.13,12.57,6.76,24.04,15.83,32.92,9.34,9.29,21.2,14.2,34.23,16.51Z" />
`;

// Generate Mark SVGs
function createMarkSvg(fillColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="149 37 543 382" fill="${fillColor}">
  <g fill="${fillColor}">
    ${EMBLEM_PATHS}
  </g>
</svg>`;
}

// Generate Full Logo SVGs with gold color
function createFullGoldSvg() {
  const originalSvg = fs.readFileSync(path.join(LOGO_DIR, "logo-black.svg"), "utf8");
  return originalSvg.replaceAll("#000000", "#D4AF37");
}

async function generateAssets() {
  console.log("🎨 Generating Becca's Crown brand SVGs...");

  // Write Mark SVGs
  fs.writeFileSync(path.join(LOGO_DIR, "logo-mark-white.svg"), createMarkSvg("#FFFFFF"));
  fs.writeFileSync(path.join(LOGO_DIR, "logo-mark-black.svg"), createMarkSvg("#000000"));
  fs.writeFileSync(path.join(LOGO_DIR, "logo-mark-gold.svg"), createMarkSvg("#D4AF37"));
  fs.writeFileSync(path.join(LOGO_DIR, "logo-gold.svg"), createFullGoldSvg());

  console.log("📐 Generating App Icons (192, 512, Maskable, Apple Touch Icon)...");

  // App Icon: Luxury dark aesthetic (#09090B with gold emblem)
  const markGoldSvg = createMarkSvg("#E6CA65");
  const markBuf = Buffer.from(markGoldSvg);

  // Helper to composite mark centered on background
  async function generateSquareIcon(size, paddingRatio, outputPath) {
    const markSize = Math.round(size * (1 - paddingRatio * 2));
    const resizedMark = await sharp(markBuf)
      .resize({
        width: markSize,
        height: markSize,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 12, g: 11, b: 10, alpha: 1 }, // Warm dark luxury black
      },
    })
      .composite([{ input: resizedMark, gravity: "centre" }])
      .png()
      .toFile(outputPath);

    console.log(`  ✓ Created: ${path.relative(ROOT_DIR, outputPath)} (${size}x${size})`);
  }

  // 1. Standard Icons (192x192, 512x512)
  await generateSquareIcon(192, 0.14, path.join(ICONS_DIR, "icon-192.png"));
  await generateSquareIcon(512, 0.14, path.join(ICONS_DIR, "icon-512.png"));

  // 2. Maskable Icons (safe zone requires 20% padding)
  await generateSquareIcon(192, 0.22, path.join(ICONS_DIR, "icon-maskable-192.png"));
  await generateSquareIcon(512, 0.22, path.join(ICONS_DIR, "icon-maskable-512.png"));

  // 3. Apple Touch Icon (180x180)
  await generateSquareIcon(180, 0.15, path.join(ICONS_DIR, "apple-touch-icon.png"));
  await generateSquareIcon(180, 0.15, path.join(PUBLIC_DIR, "apple-touch-icon.png"));

  // 4. Favicon (48x48, 32x32)
  const favicon48 = path.join(PUBLIC_DIR, "favicon-48.png");
  const favicon32 = path.join(PUBLIC_DIR, "favicon-32.png");
  const favicon16 = path.join(PUBLIC_DIR, "favicon-16.png");
  await generateSquareIcon(48, 0.12, favicon48);
  await generateSquareIcon(32, 0.12, favicon32);
  await generateSquareIcon(16, 0.10, favicon16);

  // Copy 48px to favicon.ico (modern browsers accept 48x48 PNG/ICO)
  fs.copyFileSync(favicon48, path.join(PUBLIC_DIR, "favicon.ico"));
  fs.copyFileSync(favicon48, path.join(ROOT_DIR, "app", "favicon.ico"));
  console.log("  ✓ Created: public/favicon.ico & app/favicon.ico");

  // Clean up intermediate favicons
  try {
    fs.unlinkSync(favicon48);
    fs.unlinkSync(favicon32);
    fs.unlinkSync(favicon16);
  } catch {}

  console.log("✨ All official Becca's Crown brand assets generated successfully!");
}

generateAssets().catch(console.error);
