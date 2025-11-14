import fs from 'fs/promises';
import path from 'path';

async function extractAudioFromDebug() {
  try {
    console.log('📖 Reading debug file...');
    const debugFile = './music_response_debug_2025-11-14T22-04-02-663Z.json';
    const debugContent = await fs.readFile(debugFile, 'utf8');
    
    console.log('🔍 Parsing JSON...');
    const debugData = JSON.parse(debugContent);
    
    console.log('📋 Debug data structure:');
    console.log('- Keys:', Object.keys(debugData));
    console.log('- Response type:', debugData.responseType);
    console.log('- Has audio property:', debugData.hasAudio);
    
    if (debugData.stringified) {
      console.log('🔍 Parsing stringified response...');
      const musicResponse = JSON.parse(debugData.stringified);
      
      console.log('📋 Music response structure:');
      console.log('- Keys:', Object.keys(musicResponse));
      console.log('- Has audio:', !!musicResponse.audio);
      console.log('- Has filename:', !!musicResponse.filename);
      console.log('- Has json:', !!musicResponse.json);
      
      if (musicResponse.audio) {
        console.log('🎵 Found audio property!');
        console.log('- Audio type:', typeof musicResponse.audio);
        console.log('- Audio keys:', Object.keys(musicResponse.audio || {}));
        
        // Method 4 logic from our server code
        const audioData = musicResponse.audio;
        let audioBuffer;
        
        if (audioData._type === 'Buffer' && audioData.hexStart) {
          console.log('📦 Audio is a Buffer with hex data');
          console.log('- Buffer length:', audioData.length);
          console.log('- Hex start preview:', audioData.hexStart.substring(0, 40));
          
          // This means the full buffer was truncated in the JSON stringify
          // But we have the hex start - let's see if it contains MP3 headers
          const hexStart = audioData.hexStart;
          if (hexStart.startsWith('fff') || hexStart.includes('fff')) {
            console.log('🎯 Found MP3 sync headers in hex data!');
            console.log('- Full hex length:', hexStart.length, 'characters');
            console.log('- This represents', hexStart.length / 2, 'bytes');
            
            // Convert hex to buffer and save what we have
            const partialBuffer = Buffer.from(hexStart, 'hex');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = musicResponse.filename || 'recovered_audio';
            const audioFile = `./recovered_${filename}_${timestamp}.mp3`;
            
            await fs.writeFile(audioFile, partialBuffer);
            console.log(`✅ Partial audio saved: ${audioFile} (${partialBuffer.length} bytes from hex)`);
            console.log('⚠️  Note: This is only the first 100 bytes due to JSON stringification limits');
          } else {
            console.log('❌ No MP3 sync headers found in hex preview');
          }
        } else if (Buffer.isBuffer(audioData)) {
          console.log('📦 Audio is a direct Buffer');
          audioBuffer = audioData;
        } else if (typeof audioData === 'string') {
          console.log('📦 Audio is a string, trying base64 decode');
          audioBuffer = Buffer.from(audioData, 'base64');
        } else if (audioData.type === 'Buffer' && Array.isArray(audioData.data)) {
          console.log('📦 Audio is a serialized Buffer with data array');
          console.log('- Data array length:', audioData.data.length, 'bytes');
          audioBuffer = Buffer.from(audioData.data);
        } else {
          console.log('❓ Unknown audio data format:', typeof audioData);
          console.log('Audio data sample:', JSON.stringify(audioData).substring(0, 200));
        }
        
        if (audioBuffer && audioBuffer.length > 0) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = musicResponse.filename || 'recovered_audio';
          const audioFile = `./recovered_${filename}_${timestamp}.mp3`;
          
          await fs.writeFile(audioFile, audioBuffer);
          console.log(`✅ Audio file saved: ${audioFile} (${audioBuffer.length} bytes)`);
          
          // Check if it's a valid MP3
          const firstBytes = audioBuffer.slice(0, 10).toString('hex');
          console.log('🔍 First 10 bytes (hex):', firstBytes);
          if (firstBytes.startsWith('fff') || firstBytes.includes('fff')) {
            console.log('🎯 Valid MP3 sync headers detected!');
          } else {
            console.log('⚠️  No MP3 sync headers in first bytes');
          }
        }
      } else {
        console.log('❌ No audio property found in response');
      }
      
      if (musicResponse.filename) {
        console.log('📝 Original filename:', musicResponse.filename);
      }
      
    } else {
      console.log('❌ No stringified response found in debug data');
    }
    
  } catch (error) {
    console.error('❌ Error extracting audio:', error);
  }
}

extractAudioFromDebug();