#!/usr/bin/env node
/**
 * Step 1: Extract and clean MP3 bytes from the response JSON
 * - Reads endOfResponse.json
 * - Removes multipart boundaries
 * - Saves clean bytes to clean_mp3_bytes.json
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Step 1: Extracting bytes from response...\n');

// Read the JSON file
const responseFile = path.join(__dirname, 'MCP/server/src/endOfResponse.json');
let responseData;

try {
  const rawData = fs.readFileSync(responseFile, 'utf-8');
  responseData = JSON.parse(rawData);
  console.log(`✓ Loaded JSON (${responseData.mp3.bytes.length} bytes)`);
} catch (err) {
  console.error('❌ Error reading JSON:', err.message);
  process.exit(1);
}

const allBytes = responseData.mp3.bytes;

// Convert to Buffer to find and remove boundary markers
const buffer = Buffer.from(allBytes);
const bufferHex = buffer.toString('hex');

// The boundary we found: "------boundaryf57a3f35ad3445ea833590fa1eaafc9a--"
// In hex: 2d2d2d2d2d2d626f756e6461727966353761336633356164333434356561383333353930666131656161666339612d2d
const boundaryStart = '2d2d2d2d2d2d626f756e64617279';
const boundaryEnd = '2d2d0d0a';

console.log('\n🔍 Searching for boundary markers...');

// Find all boundary positions
const boundaryMatches = [];
let searchHex = bufferHex;
let offset = 0;

while (true) {
  const idx = searchHex.indexOf(boundaryStart);
  if (idx === -1) break;
  
  // Convert hex offset to byte offset
  const byteOffset = offset + (idx / 2);
  boundaryMatches.push({
    hexOffset: idx,
    byteOffset: Math.floor(byteOffset),
    type: 'start'
  });
  
  offset += idx / 2 + boundaryStart.length / 2;
  searchHex = searchHex.substring(idx + boundaryStart.length);
}

console.log(`Found ${boundaryMatches.length} boundary markers`);

if (boundaryMatches.length > 0) {
  console.log('\n📍 Boundary locations:');
  boundaryMatches.forEach((match, i) => {
    console.log(`  ${i}: byte offset ${match.byteOffset}`);
  });

  // Find the CRLF after first boundary
  const firstBoundaryEnd = boundaryMatches[0].byteOffset;
  let crlfPos = firstBoundaryEnd;
  
  while (crlfPos < allBytes.length - 1) {
    if (allBytes[crlfPos] === 13 && allBytes[crlfPos + 1] === 10) {
      console.log(`\n✓ Found CRLF at byte ${crlfPos}`);
      break;
    }
    crlfPos++;
  }

  // The audio data comes BEFORE the boundary marker
  // Start from beginning, end at the boundary
  let audioStart = 0;
  let audioEnd = boundaryMatches[0].byteOffset;
  
  // Skip any leading whitespace/CRLF before boundary
  while (audioEnd > 0 && (allBytes[audioEnd - 1] === 13 || allBytes[audioEnd - 1] === 10)) {
    audioEnd--;
  }

  console.log(`\n📦 Extracting audio bytes from ${audioStart} to ${audioEnd}`);
  
  const cleanBytes = allBytes.slice(audioStart, audioEnd);
  console.log(`✓ Extracted ${cleanBytes.length} clean audio bytes`);

  // Check first bytes for MP3 sync header
  console.log(`\n🎵 First 10 bytes (hex): ${Buffer.from(cleanBytes.slice(0, 10)).toString('hex')}`);
  
  if (cleanBytes[0] === 0xFF) {
    console.log('✓ Looks like valid MP3! (starts with 0xFF sync byte)');
  }

  // Save clean bytes
  const outputFile = path.join(__dirname, 'clean_mp3_bytes.json');
  fs.writeFileSync(outputFile, JSON.stringify({ bytes: cleanBytes }, null, 2));
  console.log(`\n✅ Saved to ${outputFile}`);

} else {
  console.log('\n⚠️  No boundaries found. Assuming entire array is audio data.');
  const outputFile = path.join(__dirname, 'clean_mp3_bytes.json');
  fs.writeFileSync(outputFile, JSON.stringify({ bytes: allBytes }, null, 2));
  console.log(`✅ Saved to ${outputFile}`);
}
