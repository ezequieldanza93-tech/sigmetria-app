const sharp = require('sharp');
const fs = require('fs');

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
  '<defs>' +
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#4CAF50"/>' +
      '<stop offset="100%" stop-color="#2E7D32"/>' +
    '</linearGradient>' +
  '</defs>' +
  '<rect width="512" height="512" rx="96" fill="url(#bg)"/>' +
  '<text x="256" y="340" text-anchor="middle" fill="white" font-size="320" font-weight="bold" font-family="system-ui, sans-serif">S</text>' +
'</svg>';

const sizes = [192, 512];

async function main() {
  if (!fs.existsSync('public/icons')) {
    fs.mkdirSync('public/icons', { recursive: true });
  }
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`);
    console.log(`Generated icon-${size}.png`);
  }
  console.log('OK - todos los iconos generados');
}

main().catch(console.error);
