// Script to create simple PNG icons for Office Add-in
// Office Add-ins require PNG format, not SVG

const fs = require('fs');
const path = require('path');

// Simple PNG creator - creates a basic colored square with transparency
function createPNG(width, height, color = { r: 0, g: 51, b: 160 }) {
  // PNG file structure
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);  // Width
  ihdrData.writeUInt32BE(height, 4); // Height
  ihdrData.writeUInt8(8, 8);         // Bit depth
  ihdrData.writeUInt8(6, 9);         // Color type (RGBA)
  ihdrData.writeUInt8(0, 10);        // Compression
  ihdrData.writeUInt8(0, 11);        // Filter
  ihdrData.writeUInt8(0, 12);        // Interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk - create image data
  const rawData = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 2;

  for (let y = 0; y < height; y++) {
    rawData.push(0); // Filter byte
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        // Inside circle - blue color
        rawData.push(color.r, color.g, color.b, 255);
      } else if (distance <= radius + 1) {
        // Anti-aliased edge
        const alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - distance) * 255)));
        rawData.push(color.r, color.g, color.b, alpha);
      } else {
        // Outside - transparent
        rawData.push(0, 0, 0, 0);
      }
    }
  }

  // Compress using zlib (deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return crc ^ 0xFFFFFFFF;
}

function makeCRCTable() {
  const table = new Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

// Create icons at all required sizes
const sizes = [16, 32, 64, 80, 128];
const outputDir = path.join(__dirname, '..', 'public', 'outlook');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

sizes.forEach(size => {
  const png = createPNG(size, size);
  const filename = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

console.log('All PNG icons created successfully!');
