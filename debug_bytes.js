#!/usr/bin/env node
/**
 * Debug: Examine the byte structure in detail
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging byte structure...\n');

const cleanFile = path.join(__dirname, 'clean_mp3_bytes.json');
const cleanData = JSON.parse(fs.readFileSync(cleanFile, 'utf-8'));
const bytes = cleanData.bytes;

console.log(`Total bytes: ${bytes.length}\n`);

// Look for patterns
console.log('📊 Byte value distribution:');
const valueCount = {};
for (let i = 0; i < bytes.length; i++) {
  const val = bytes[i];
  valueCount[val] = (valueCount[val] || 0) + 1;
}

const sorted = Object.entries(valueCount)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 20);

sorted.forEach(([val, count]) => {
  const hex = '0x' + parseInt(val).toString(16).padStart(2, '0').toUpperCase();
  const pct = ((count / bytes.length) * 100).toFixed(1);
  console.log(`  ${hex}: ${count} times (${pct}%)`);
});

console.log('\n🔎 Looking at structure in chunks...\n');

// Check for patterns
console.log('First 50 bytes (hex):');
console.log(Buffer.from(bytes.slice(0, 50)).toString('hex'));

console.log('\nBytes 40-90 (hex):');
console.log(Buffer.from(bytes.slice(40, 90)).toString('hex'));

// Count FF bytes
let ffCount = 0;
let ffbfaCount = 0;
let ffPositions = [];

for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0xFF) {
    ffCount++;
    ffPositions.push(i);
    if (bytes[i+1] === 0xFB || bytes[i+1] === 0xFA) {
      ffbfaCount++;
    }
  }
}

console.log(`\n📈 0xFF byte analysis:`);
console.log(`  Total 0xFF: ${ffCount}`);
console.log(`  0xFF + (FB|FA): ${ffbfaCount}`);
console.log(`  First 10 0xFF positions: ${ffPositions.slice(0, 10).join(', ')}`);

// Check if the whole thing might be valid
console.log('\n\n🔍 Checking if ENTIRE dataset is MP3...\n');
const totalBuffer = Buffer.from(bytes);
console.log('Full data first 50 bytes (hex):');
console.log(totalBuffer.slice(0, 50).toString('hex'));

console.log('\nFull data last 50 bytes (hex):');
console.log(totalBuffer.slice(-50).toString('hex'));

// Count trailing bytes
let trailingCount = 0;
for (let i = bytes.length - 1; i >= 0; i--) {
  if (bytes[i] === 0x55 || bytes[i] === 0x0D || bytes[i] === 0x0A) {
    trailingCount++;
  } else {
    break;
  }
}

console.log(`\n⚠️  Trailing padding/boundary bytes: ${trailingCount}`);
console.log(`Real content might be: ${bytes.length - trailingCount} bytes`);
