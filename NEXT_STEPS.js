#!/usr/bin/env node
/**
 * COMPREHENSIVE: What we should do NEXT TIME to capture music response properly
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║  MUSIC RESPONSE CAPTURE STRATEGY                                  ║
╚════════════════════════════════════════════════════════════════════╝

❌ CURRENT PROBLEM:
   - composeDetailed() returns a stream/buffer with audio data
   - Console logging truncates long data
   - We're missing the middle of the file
   - Result: silent audio

✅ SOLUTION: Intercept and save the response directly to a file

IMPLEMENTATION:
`);

const code = `
// In your index.ts, replace the music response handler:

try {
  musicResponse = await client.music.composeDetailed({
    compositionPlan: finalCompositionPlan
  });

  // Create a unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const audioFile = \`./music_\${timestamp}.mp3\`;
  
  // Method 1: If it's a stream, pipe it directly
  if (musicResponse && typeof musicResponse[Symbol.asyncIterator] === 'function') {
    const writeStream = fs.createWriteStream(audioFile);
    for await (const chunk of musicResponse) {
      writeStream.write(chunk);
    }
    await new Promise(resolve => writeStream.end(resolve));
    console.log(\`✅ Audio saved to: \${audioFile}\`);
  }
  
  // Method 2: If it's a Buffer, write directly
  else if (Buffer.isBuffer(musicResponse)) {
    fs.writeFileSync(audioFile, musicResponse);
    console.log(\`✅ Audio saved (buffer): \${audioFile}\`);
  }
  
  // Method 3: Generic fallback - try to convert to buffer
  else {
    const chunks = [];
    if (musicResponse.body) {
      for await (const chunk of musicResponse.body) {
        chunks.push(chunk);
      }
    } else {
      for await (const chunk of musicResponse) {
        chunks.push(chunk);
      }
    }
    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(audioFile, buffer);
    console.log(\`✅ Audio saved (stream): \${audioFile}\`);
  }
  
} catch (error) {
  console.error("Error generating music:", error);
  return error;
}
`;

console.log(code);

console.log(`
📝 WHY THIS WORKS:
   - Streams are not logged, they're piped directly to disk
   - No truncation of console output
   - Full audio file captured immediately
   - File can be played back as-is

📊 CURRENT FILES:
`);

const files = fs.readdirSync(path.join(__dirname));
const mp3Files = files.filter(f => f.includes('recovered'));

if (mp3Files.length > 0) {
  mp3Files.forEach(f => {
    const stats = fs.statSync(path.join(__dirname, f));
    console.log(`   - ${f}: ${stats.size} bytes`);
  });
} else {
  console.log('   (none found)');
}

console.log(`
🎯 NEXT STEPS:
   1. Update index.ts with the code above
   2. Run the API call again
   3. The music_TIMESTAMP.mp3 file will be the real audio
   4. No manual recovery needed!
`);
