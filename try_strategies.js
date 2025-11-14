#!/usr/bin/env node
/**
 * Try different extraction strategies
 */

const fs = require('fs');
const path = require('path');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

console.log('📊 Testing extraction strategies...\n');

// Strategy 1: From first 0xFF to end - 328
let strategy1Start = -1;
for (let i = 0; i < bytes.length; i++) {
  if (bytes[i] === 0xFF) {
    strategy1Start = i;
    break;
  }
}

const strategy1 = bytes.slice(strategy1Start, bytes.length - 328);
console.log(`Strategy 1 (First 0xFF to end-328):`);
console.log(`  Start: ${strategy1Start}, Size: ${strategy1.length} bytes`);
console.log(`  First 20 bytes (hex): ${Buffer.from(strategy1.slice(0, 20)).toString('hex')}`);

// Strategy 2: Entire thing minus padding
const strategy2 = bytes.slice(0, bytes.length - 328);
console.log(`\nStrategy 2 (All bytes minus padding):`);
console.log(`  Size: ${strategy2.length} bytes`);
console.log(`  First 20 bytes (hex): ${Buffer.from(strategy2.slice(0, 20)).toString('hex')}`);

// Strategy 3: Maybe the format is: header + MP3 + padding?
// Try to identify where actual MP3 frames start consistently
console.log(`\nStrategy 3 (Find first valid MP3 frame sequence):`);
let frameSequenceStart = -1;
for (let i = 0; i < bytes.length - 10; i++) {
  if (bytes[i] === 0xFF && bytes[i+1] === 0xFB) {
    // Found a potential frame start
    // Check if next frame is roughly the right distance away
    let distance = 1000; // Rough estimate for 128kbps MP3
    if (i + distance < bytes.length && bytes[i + distance] === 0xFF) {
      frameSequenceStart = i;
      break;
    }
  }
}

if (frameSequenceStart > 0) {
  const strategy3 = bytes.slice(frameSequenceStart, bytes.length - 328);
  console.log(`  Found frame sequence at: ${frameSequenceStart}`);
  console.log(`  Size: ${strategy3.length} bytes`);
  
  // Save all strategies
  const strategies = [
    { name: 'v1_first_ff', data: strategy1 },
    { name: 'v2_all_minus_padding', data: strategy2 },
    { name: 'v3_frame_start', data: strategy3 }
  ];
  
  strategies.forEach(s => {
    const file = path.join(__dirname, `recovered_music_${s.name}.mp3`);
    fs.writeFileSync(file, Buffer.from(s.data));
    console.log(`\n✅ Saved ${s.name}: ${file} (${s.data.length} bytes)`);
  });
} else {
  // Just save strategies 1 and 2
  const strategies = [
    { name: 'v1_first_ff', data: strategy1 },
    { name: 'v2_all_minus_padding', data: strategy2 }
  ];
  
  strategies.forEach(s => {
    const file = path.join(__dirname, `recovered_music_${s.name}.mp3`);
    fs.writeFileSync(file, Buffer.from(s.data));
    console.log(`\n✅ Saved ${s.name}: ${file} (${s.data.length} bytes)`);
  });
}
