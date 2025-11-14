#!/usr/bin/env node
/**
 * Verify MP3 file validity
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking MP3 file validity...\n');

const files = [
  'recovered_music_D_skip44.mp3',
  'recovered_music_B_raw.mp3', 
  'recovered_music_C_original_json.mp3'
];

files.forEach(filename => {
  const filepath = path.join(__dirname, filename);
  if (fs.existsSync(filepath)) {
    const buffer = fs.readFileSync(filepath);
    console.log(`📄 ${filename}`);
    console.log(`   Size: ${buffer.length} bytes`);
    console.log(`   First 20 bytes: ${buffer.slice(0, 20).toString('hex')}`);
    
    // Check for ID3 tag
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      console.log('   ✓ Has ID3v2 tag');
    }
    
    // Check for MP3 frame sync
    let syncCount = 0;
    for (let i = 0; i < Math.min(5000, buffer.length - 1); i++) {
      if (buffer[i] === 0xFF && (buffer[i+1] === 0xFB || buffer[i+1] === 0xFA)) {
        syncCount++;
      }
    }
    console.log(`   MP3 frame syncs (in first 5000 bytes): ${syncCount}`);
    console.log(`   Last 20 bytes: ${buffer.slice(-20).toString('hex')}`);
    console.log('');
  }
});

console.log('\n\n💡 Hypothesis: The data might not be MP3 at all!\n');
console.log('What if it\'s a different audio format? Let me check:\n');

// Check for other audio formats
const testFile = path.join(__dirname, 'recovered_music_B_raw.mp3');
const testBuffer = fs.readFileSync(testFile);

console.log('Checking for other audio formats:');
console.log(`  WAV header (RIFF): ${testBuffer[0] === 0x52 && testBuffer[1] === 0x49 ? '✓ POSSIBLE' : '✗'}`);
console.log(`  OGG header: ${testBuffer[0] === 0x4F && testBuffer[1] === 0x67 ? '✓ POSSIBLE' : '✗'}`);
console.log(`  FLAC header: ${testBuffer[0] === 0x66 && testBuffer[1] === 0x4C ? '✓ POSSIBLE' : '✗'}`);
console.log(`  M4A/MP4 header: ${testBuffer.includes(Buffer.from('ftyp')) ? '✓ POSSIBLE' : '✗'}`);
console.log(`  AAC header (ADTS): ${testBuffer[0] === 0xFF && testBuffer[1] === 0xF1 ? '✓ POSSIBLE' : '✗'}`);

// Print first 200 bytes in multiple formats
console.log('\n\nFirst 200 bytes analysis:');
console.log('Hex:');
console.log(testBuffer.slice(0, 200).toString('hex'));

console.log('\n\nAs ASCII (printable chars only):');
let ascii = '';
for (let i = 0; i < 200; i++) {
  const c = testBuffer[i];
  if (c >= 32 && c < 127) {
    ascii += String.fromCharCode(c);
  } else {
    ascii += '.';
  }
}
console.log(ascii);
