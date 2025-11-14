#!/usr/bin/env node
/**
 * Step 2: Analyze the cleaned bytes to find where MP3 data actually starts
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Step 2: Analyzing byte structure...\n');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

console.log(`Total bytes: ${bytes.length}`);
console.log(`\nFirst 100 bytes (hex):`);
console.log(Buffer.from(bytes.slice(0, 100)).toString('hex'));

console.log(`\n\nLast 100 bytes (hex):`);
console.log(Buffer.from(bytes.slice(-100)).toString('hex'));

// Search for MP3 sync header (0xFF followed by 0xFB or 0xFA)
console.log(`\n\n🔎 Searching for MP3 sync headers (0xFF)...\n`);

let syncHeaderPositions = [];
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0xFF && (bytes[i+1] === 0xFB || bytes[i+1] === 0xFA)) {
    syncHeaderPositions.push(i);
  }
}

console.log(`Found ${syncHeaderPositions.length} potential MP3 sync headers`);

if (syncHeaderPositions.length > 0) {
  console.log(`\nFirst sync header at byte: ${syncHeaderPositions[0]}`);
  console.log(`Last sync header at byte: ${syncHeaderPositions[syncHeaderPositions.length - 1]}`);
  
  if (syncHeaderPositions[0] > 0) {
    console.log(`\n⚠️  There are ${syncHeaderPositions[0]} bytes BEFORE the first MP3 sync header`);
    console.log(`These are likely metadata or headers. Let's check them:\n`);
    
    const headerBytes = bytes.slice(0, Math.min(100, syncHeaderPositions[0]));
    console.log('First part (hex):', Buffer.from(headerBytes).toString('hex'));
    console.log('First part (utf-8):', Buffer.from(headerBytes).toString('utf-8', 0, Math.min(50, headerBytes.length)));
  }
} else {
  console.log('\n❌ No clear MP3 sync headers found!');
  console.log('Checking for 0xFF bytes...');
  
  let ffPositions = [];
  for (let i = 0; i < Math.min(1000, bytes.length); i++) {
    if (bytes[i] === 0xFF) {
      ffPositions.push(i);
    }
  }
  
  console.log(`Found ${ffPositions.length} 0xFF bytes in first 1000 bytes`);
  if (ffPositions.length > 0) {
    console.log(`First few: ${ffPositions.slice(0, 10).join(', ')}`);
  }
}
