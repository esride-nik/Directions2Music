#!/usr/bin/env node
/**
 * Decode the header to understand the format
 */

const fs = require('fs');
const path = require('path');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

console.log('🔍 Analyzing first 44 header bytes...\n');

const headerBytes = bytes.slice(0, 44);
const headerBuffer = Buffer.from(headerBytes);

console.log('Raw hex:');
console.log(headerBuffer.toString('hex'));

console.log('\n\nTrying to decode as different formats:\n');

// Try as little-endian sizes
console.log('As little-endian 4-byte integers:');
for (let i = 0; i < 44; i += 4) {
  if (i + 4 <= 44) {
    const val = headerBuffer.readUInt32LE(i);
    console.log(`  Offset ${i}: 0x${val.toString(16)} (${val})`);
  }
}

// Try as big-endian
console.log('\n\nAs big-endian 4-byte integers:');
for (let i = 0; i < 44; i += 4) {
  if (i + 4 <= 44) {
    const val = headerBuffer.readUInt32BE(i);
    console.log(`  Offset ${i}: 0x${val.toString(16)} (${val})`);
  }
}

console.log('\n\n✂️  Let me just use the entire dataset from the start...\n');

// Maybe we should use everything from position 0 and only strip the tail
console.log('Strategy: Take all bytes from 0 to (length - 328)');
const audioBytes = bytes.slice(0, bytes.length - 328);
console.log(`Audio size: ${audioBytes.length} bytes`);

// Find MP3 sync headers in this range
let syncCount = 0;
for (let i = 0; i < audioBytes.length - 1; i++) {
  if (audioBytes[i] === 0xFF && (audioBytes[i+1] === 0xFB || audioBytes[i+1] === 0xFA)) {
    syncCount++;
  }
}

console.log(`MP3 sync headers in range: ${syncCount}`);

// Save this version
const outputFile = path.join(__dirname, 'recovered_music_v2.mp3');
fs.writeFileSync(outputFile, Buffer.from(audioBytes));
console.log(`\n✅ Saved v2 to: ${outputFile}`);
