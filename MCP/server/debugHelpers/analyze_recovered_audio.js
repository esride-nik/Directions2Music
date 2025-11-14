import fs from 'fs/promises';

async function analyzeRecoveredAudio() {
  try {
    const files = await fs.readdir('./');
    const recoveredFile = files.find(f => f.startsWith('recovered_music') && f.endsWith('.mp3'));
    
    if (!recoveredFile) {
      console.log('❌ No recovered file found');
      return;
    }
    
    console.log(`🔍 Analyzing ${recoveredFile}...`);
    const audioBuffer = await fs.readFile(recoveredFile);
    
    console.log(`📊 File size: ${audioBuffer.length} bytes`);
    
    // Look for MP3 sync headers (0xFF) in first 1000 bytes
    console.log('🔍 Searching for MP3 sync headers (0xFF)...');
    let foundHeaders = [];
    for (let i = 0; i < Math.min(1000, audioBuffer.length - 1); i++) {
      if (audioBuffer[i] === 0xFF && (audioBuffer[i + 1] & 0xE0) === 0xE0) {
        foundHeaders.push(i);
        if (foundHeaders.length >= 5) break; // Found enough
      }
    }
    
    if (foundHeaders.length > 0) {
      console.log(`🎯 Found MP3 sync headers at positions: ${foundHeaders.slice(0, 5).join(', ')}`);
      
      // Extract from first sync header
      const firstHeader = foundHeaders[0];
      const cleanAudio = audioBuffer.slice(firstHeader);
      const cleanFile = recoveredFile.replace('.mp3', '_clean.mp3');
      
      await fs.writeFile(cleanFile, cleanAudio);
      console.log(`✅ Clean MP3 saved: ${cleanFile} (${cleanAudio.length} bytes, starting from position ${firstHeader})`);
      
    } else {
      console.log('❌ No MP3 sync headers found in first 1000 bytes');
      
      // Show hex dump of first 100 bytes
      console.log('🔍 First 100 bytes (hex):');
      const hex = audioBuffer.slice(0, 100).toString('hex');
      for (let i = 0; i < hex.length; i += 32) {
        const offset = i / 2;
        const line = hex.slice(i, i + 32);
        console.log(`${offset.toString(16).padStart(4, '0')}: ${line}`);
      }
      
      // Check if it might be a different audio format
      const firstFour = audioBuffer.slice(0, 4).toString();
      const firstFourHex = audioBuffer.slice(0, 4).toString('hex');
      
      console.log(`🔍 First 4 bytes as string: "${firstFour}"`);
      console.log(`🔍 First 4 bytes as hex: ${firstFourHex}`);
      
      if (firstFour === 'RIFF') {
        console.log('🎵 This appears to be WAV format');
      } else if (firstFour === 'OggS') {
        console.log('🎵 This appears to be OGG format');
      } else if (firstFour === 'fLaC') {
        console.log('🎵 This appears to be FLAC format');
      } else {
        console.log('❓ Unknown audio format');
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing audio:', error);
  }
}

analyzeRecoveredAudio();