#!/usr/bin/env node
/**
 * Add ID3 header and try different combinations
 */

const fs = require('fs');
const path = require('path');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

console.log('🎵 Testing with ID3 headers...\n');

// Minimal ID3v2 header (3 bytes: "ID3" + version + flags + size)
// Format: "ID3" + version (0x04 0x00) + flags (0x00) + size (synchsafe)
const createID3Header = () => {
  const header = Buffer.alloc(10);
  header.write('ID3'); // 0-2: Identifier
  header[3] = 0x04;    // 3: Major version
  header[4] = 0x00;    // 4: Revision
  header[5] = 0x00;    // 5: Flags
  
  // Size in synchsafe format (big-endian, 7 bits per byte)
  // For simplicity, use minimal size
  const size = 0;
  header[6] = (size >> 21) & 0x7F;
  header[7] = (size >> 14) & 0x7F;
  header[8] = (size >> 7) & 0x7F;
  header[9] = size & 0x7F;
  
  return header;
};

console.log('Strategy A: Raw bytes + ID3 header at start\n');
const id3Header = createID3Header();
const strategyA = Buffer.concat([id3Header, Buffer.from(bytes)]);
const fileA = path.join(__dirname, 'recovered_music_A_id3_prefix.mp3');
fs.writeFileSync(fileA, strategyA);
console.log(`✅ Saved A: ${fileA} (${strategyA.length} bytes)`);

console.log('\nStrategy B: Just the raw bytes as-is\n');
const strategyB = Buffer.from(bytes);
const fileB = path.join(__dirname, 'recovered_music_B_raw.mp3');
fs.writeFileSync(fileB, strategyB);
console.log(`✅ Saved B: ${fileB} (${strategyB.length} bytes)`);

console.log('\nStrategy C: Entire original JSON bytes array (maybe we extracted wrong)\n');

// Re-read the original endOfResponse.json
const endFile = path.join(__dirname, 'MCP/server/src/endOfResponse.json');
try {
  const endData = JSON.parse(fs.readFileSync(endFile, 'utf-8'));
  const strategyC = Buffer.from(endData.mp3.bytes);
  const fileC = path.join(__dirname, 'recovered_music_C_original_json.mp3');
  fs.writeFileSync(fileC, strategyC);
  console.log(`✅ Saved C: ${fileC} (${strategyC.length} bytes)`);
} catch (e) {
  console.log(`⚠️  Could not read original JSON: ${e.message}`);
}

console.log('\n\n📝 Analysis:');
console.log(`  - First 100 bytes of raw: ${Buffer.from(bytes.slice(0, 100)).toString('hex')}`);
console.log(`  - Contains 0xFF at position: ${bytes.indexOf(0xFF)}`);

// Check if it might be an audio stream without frame headers
console.log(`\n\nStrategy D: Skip first 44 bytes (potential header/metadata)\n`);
const strategyD = Buffer.from(bytes.slice(44));
const fileD = path.join(__dirname, 'recovered_music_D_skip44.mp3');
fs.writeFileSync(fileD, strategyD);
console.log(`✅ Saved D: ${fileD} (${strategyD.length} bytes)`);
console.log(`  - Starts with: ${Buffer.from(strategyD.slice(0, 20)).toString('hex')}`);

console.log('\n\n🎯 Next steps: Try playing each file or use ffprobe to check:\n');
console.log('  ffprobe recovered_music_*.mp3');
console.log('  ffplay recovered_music_*.mp3  (for quick preview)\n');
