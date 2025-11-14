#!/usr/bin/env node
/**
 * Step 3: Extract MP3 audio and save as file
 */

const fs = require('fs');
const path = require('path');

console.log('🎵 Step 3: Extracting MP3 audio...\n');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

// Find first MP3 sync header
let mp3Start = -1;
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0xFF && (bytes[i+1] === 0xFB || bytes[i+1] === 0xFA)) {
    mp3Start = i;
    break;
  }
}

if (mp3Start === -1) {
  console.error('❌ No MP3 sync header found!');
  process.exit(1);
}

// Find where real audio ends (before the padding/boundary area)
// The tail shows lots of 0x55 bytes, so find where those start
let mp3End = bytes.length;
for (let i = bytes.length - 1; i > mp3Start; i--) {
  // Look for a sequence of non-audio bytes
  if (bytes[i] === 0x55 && bytes[i-1] === 0x55 && bytes[i-2] === 0x55) {
    mp3End = i - 2;
    break;
  }
}

console.log(`✓ MP3 data: byte ${mp3Start} to ${mp3End}`);
console.log(`✓ Audio size: ${mp3End - mp3Start} bytes\n`);

const mp3Bytes = bytes.slice(mp3Start, mp3End);

// Save as MP3 file
const outputFile = path.join(__dirname, 'recovered_music.mp3');
fs.writeFileSync(outputFile, Buffer.from(mp3Bytes));
console.log(`✅ Saved MP3 to: ${outputFile}`);

// Also save metadata
const metadata = {
  originalTotalBytes: bytes.length,
  headerBytes: mp3Start,
  audioBytes: mp3Bytes.length,
  paddingBytes: bytes.length - mp3End,
  firstBytes: Buffer.from(mp3Bytes.slice(0, 20)).toString('hex'),
  recoveredAt: new Date().toISOString()
};

const metaFile = path.join(__dirname, 'recovery_metadata.json');
fs.writeFileSync(metaFile, JSON.stringify(metadata, null, 2));
console.log(`📝 Metadata saved to: ${metaFile}\n`);

console.log(metadata);
