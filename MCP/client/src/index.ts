import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StyleCard } from "../../server/src/schemas.js";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files (MP3s) from MCP server directory
const serverDir = path.resolve(__dirname, '../../server');
app.use('/audio', express.static(serverDir));

// Helper function to extract and validate StyleCard from tool result
function extractStyleCard(toolResult: any): StyleCard {
  if (toolResult?.structuredContent) {
    return toolResult.structuredContent as StyleCard;
  }
  throw new Error('No structuredContent in tool result');
}

// Helper function to find the latest music file
async function findLatestMusicFile(): Promise<string | null> {
  try {
    const files = await fs.readdir(serverDir);
    const musicFiles = files.filter(file => 
      file.startsWith('music_') && file.endsWith('.mp3')
    );
    
    if (musicFiles.length === 0) return null;
    
    // Sort by modification time (newest first)
    const fileStats = await Promise.all(
      musicFiles.map(async file => {
        const stats = await fs.stat(path.join(serverDir, file));
        return { file, mtime: stats.mtime };
      })
    );
    
    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return fileStats[0].file;
  } catch (error) {
    console.error('Error finding latest music file:', error);
    return null;
  }
}

// Create MCP client connection
async function createMcpClient() {
  const baseUrl = 'http://localhost:3000/mcp';
  const client = new Client({
    name: 'directions2music-client',
    version: '1.0.0'
  });
  
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
  await client.connect(transport);
  console.log('✅ Connected to MCP Server');
  return client;
}

// Main orchestration endpoint
app.post('/orchestrate', async (req, res) => {
  console.log('\n**********************************\n🎯 Starting music orchestration...\n**********************************');
  
  try {
    const { directions, dummyMode = false } = req.body;
    
    if (!directions || !Array.isArray(directions)) {
      return res.status(400).json({
        error: 'Invalid request: directions array is required'
      });
    }
    
    console.log(`📍 Processing ${directions.length} direction steps (dummy: ${dummyMode})`);
    
    // Create MCP client
    const client = await createMcpClient();
    
    try {
      // Step 1: Find musical style
      console.log('🎨 Finding musical style...');
      const musicalStyleResult = await client.callTool({
        name: 'find-musical-style',
        arguments: {
          directions: directions,
          dummyMode: dummyMode
        }
      });
      
      const styleCard: StyleCard = extractStyleCard(musicalStyleResult);
      console.log(`🎵 Style: ${styleCard.genre} - ${styleCard.songTitle}`);
      
      // Step 2: Generate music
      console.log('🎼 Generating music...');
      const musicGenerationResult = await client.callTool({
        name: 'generate-music',
        arguments: {
          styleCard: styleCard,
          lyrics: directions,
          dummyMode: dummyMode
        }
      });
      
      console.log('✅ Music generation completed');
      
      // Step 3: Find the generated audio file
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a moment for file to be written
      const audioFile = await findLatestMusicFile();
      
      if (!audioFile) {
        console.warn('⚠️  No audio file found');
        return res.json({
          success: true,
          styleCard: styleCard,
          musicResult: musicGenerationResult,
          audioUrl: null,
          message: 'Music generated but audio file not found'
        });
      }
      
      console.log(`🎵 Audio file ready: ${audioFile}`);
      
      // Return success response
      res.json({
        success: true,
        styleCard: styleCard,
        musicResult: musicGenerationResult,
        audioUrl: `/audio/${audioFile}`,
        audioFile: audioFile,
        message: `Successfully generated ${styleCard.genre} music: "${styleCard.songTitle}"`
      });
      
    } finally {
      await client.close();
    }
    
  } catch (error) {
    console.error('❌ Error during orchestration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate music'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mcpServer: 'http://localhost:3000'
  });
});

// List available audio files
app.get('/audio-files', async (req, res) => {
  try {
    const files = await fs.readdir(serverDir);
    const musicFiles = files.filter(file => 
      file.startsWith('music_') && file.endsWith('.mp3')
    );
    
    const fileDetails = await Promise.all(
      musicFiles.map(async file => {
        const stats = await fs.stat(path.join(serverDir, file));
        return {
          filename: file,
          url: `/audio/${file}`,
          size: stats.size,
          created: stats.mtime,
          sizeKB: Math.round(stats.size / 1024)
        };
      })
    );
    
    fileDetails.sort((a, b) => b.created.getTime() - a.created.getTime());
    
    res.json({
      files: fileDetails,
      total: fileDetails.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list audio files' });
  }
});

// Test endpoint with sample directions
app.get('/test', (req, res) => {
  const sampleDirections = [
    "Start at SP414, 84069, Roccadaspide, Salernes",
    "Go northwest on SP414",
    "At the roundabout, take the second exit to stay on SP414",
    "Turn left on SS166",
    "Continue forward on Via Serra"
  ];
  
  res.json({
    message: "Test endpoint - use POST /orchestrate with this sample data",
    sampleRequest: {
      method: "POST",
      url: "/orchestrate", 
      body: {
        directions: sampleDirections,
        dummyMode: true
      }
    },
    directTestUrl: `http://localhost:${PORT}/orchestrate`
  });
});

// Start the server
function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Directions2Music Client Server running on http://localhost:${PORT}`);
    console.log(`📁 Audio files served from: ${serverDir}`);
    console.log(`🎵 Audio endpoint: http://localhost:${PORT}/audio/`);
    console.log(`🎯 Orchestration: POST http://localhost:${PORT}/orchestrate`);
    console.log(`🧪 Test endpoint: GET http://localhost:${PORT}/test`);
    console.log(`🥼 Health endpoint: GET http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();