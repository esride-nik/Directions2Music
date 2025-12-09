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

// Serve static files from MCP server generated-music directory
const serverDir = path.resolve(__dirname, '../../server');
const audioDir = path.join(serverDir, 'generated-music', 'audio');
const routeGraphicsDir = path.join(serverDir, 'generated-music', 'route-graphics');
app.use('/audio', express.static(audioDir));
app.use('/route-graphics', express.static(routeGraphicsDir));

// Job tracking system
interface MusicJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  styleCard?: StyleCard;
  audioFile?: string;
  error?: string;
  directions: string[];
  dummyMode: boolean;
  routeGraphics?: any; // Route graphics data from the frontend
}

const jobs = new Map<string, MusicJob>();

// Generate unique job ID
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

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

// Background job processor
async function processJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  console.log(`� Starting job ${jobId} - Processing ${job.directions.length} directions`);

  let client: Client | null = null;
  
  try {
    // Create MCP client
    client = await createMcpClient();
    
    // Step 1: Find musical style
    console.log(`🎨 [${jobId}] Finding musical style...`);
    const musicalStyleResult = await client.callTool({
      name: 'find-musical-style',
      arguments: {
        directions: job.directions,
        dummyMode: job.dummyMode
      }
    });
    
    const styleCard: StyleCard = extractStyleCard(musicalStyleResult);
    job.styleCard = styleCard;
    console.log(`🎵 [${jobId}] Style: ${styleCard.genre} - ${styleCard.songTitle}`);
    
    // Step 2: Generate music (this is the long-running operation)
    console.log(`🎼 [${jobId}] Generating music... (this may take several minutes)`);
    const musicGenerationResult = await client.callTool({
      name: 'generate-music',
      arguments: {
        styleCard: styleCard,
        lyrics: job.directions,
        dummyMode: job.dummyMode,
        routeGraphics: job.routeGraphics // Pass route graphics to server
      }
    });
    
    console.log(`✅ [${jobId}] Music generation completed`);
    console.log(`🔍 [${jobId}] Raw MCP response:`, JSON.stringify(musicGenerationResult, null, 2));
    
    // Extract the music generation result
    let musicResult: any = null;
    try {
      if (musicGenerationResult && typeof musicGenerationResult === 'object') {
        // Try to extract from content.text or structuredContent
        const contentArray = (musicGenerationResult as any)?.content;
        if (Array.isArray(contentArray) && contentArray.length > 0 && contentArray[0]?.text) {
          musicResult = JSON.parse(contentArray[0].text);
          console.log(`🔍 [${jobId}] Parsed from content.text:`, musicResult);
        } else if ((musicGenerationResult as any)?.structuredContent) {
          musicResult = (musicGenerationResult as any).structuredContent;
          console.log(`🔍 [${jobId}] Using structuredContent:`, musicResult);
        }
      }
    } catch (parseError) {
      console.warn(`⚠️ [${jobId}] Could not parse music generation result:`, parseError);
    }
    
    console.log(`🔍 [${jobId}] Final musicResult:`, musicResult);
    console.log(`🔍 [${jobId}] Dummy mode: ${job.dummyMode}, existingFile: ${musicResult?.existingFile}, filename: ${musicResult?.filename}`);
    
    // Step 3: Handle audio file location
    let audioFile = null;
    
    if (job.dummyMode && musicResult?.existingFile && musicResult?.filename) {
      // Dummy mode: use existing file (just store filename, not full path)
      audioFile = musicResult.filename; // Just the filename for URL construction
      console.log(`🎵 [${jobId}] Dummy mode: Using existing file ${musicResult.filename}`);
      console.log(`🎵 [${jobId}] Audio filename: ${audioFile}`);
    } else {
      // Real mode: use the filename from the response if available
      if (musicResult?.filename) {
        audioFile = musicResult.filename; // Use the actual filename returned by server
        console.log(`🔍 [${jobId}] Real mode: Using filename from response: ${audioFile}`);
      } else {
        // Fallback: find the newly generated file
        console.log(`🔍 [${jobId}] Real mode: No filename in response, searching for latest file...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for file system
        audioFile = await findLatestMusicFile();
        console.log(`🔍 [${jobId}] Found audio file: ${audioFile}`);
      }
    }
    
    if (audioFile) {
      job.audioFile = audioFile;
      job.status = 'completed';
      job.endTime = new Date();
      console.log(`🎵 [${jobId}] Job completed successfully: ${audioFile}`);
    } else {
      job.status = 'failed';
      job.error = 'Audio file not found after generation';
      job.endTime = new Date();
      console.warn(`⚠️  [${jobId}] No audio file found`);
    }
    
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.endTime = new Date();
    console.error(`❌ [${jobId}] Job failed:`, error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Start music generation job (async)
app.post('/orchestrate', async (req, res) => {
  console.log('\n**********************************\n🎯 Starting async music generation...\n**********************************');
  
  try {
    const { directions, dummyMode = false, routeGraphics } = req.body;
    
    if (!directions || !Array.isArray(directions)) {
      return res.status(400).json({
        error: 'Invalid request: directions array is required'
      });
    }
    
    // Create new job
    const jobId = generateJobId();
    const job: MusicJob = {
      id: jobId,
      status: 'pending',
      startTime: new Date(),
      directions,
      dummyMode,
      routeGraphics // Store route graphics in job
    };
    
    jobs.set(jobId, job);
    
    console.log(`📋 Created job ${jobId} for ${directions.length} directions (dummy: ${dummyMode}, hasRouteGraphics: ${!!routeGraphics})`);
    
    // Start processing in background (don't await!)
    processJob(jobId).catch(error => {
      console.error(`Failed to process job ${jobId}:`, error);
    });
    
    // Return immediately with job ID
    res.json({
      success: true,
      jobId: jobId,
      status: 'pending',
      message: 'Music generation started. Use /status/:jobId to check progress.',
      statusUrl: `/status/${jobId}`,
      estimatedTime: dummyMode ? '5-10 seconds' : '2-5 minutes'
    });
    
  } catch (error) {
    console.error('❌ Error starting job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to start music generation'
    });
  }
});

// Check job status
app.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      jobId
    });
  }
  
  const response: any = {
    jobId: job.id,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime
  };
  
  if (job.status === 'completed') {
    response.success = true;
    response.styleCard = job.styleCard;
    response.audioUrl = `/audio/${job.audioFile}`;
    response.audioFile = job.audioFile;
    response.message = `Successfully generated ${job.styleCard?.genre} music: "${job.styleCard?.songTitle}"`;
    response.duration = job.endTime ? job.endTime.getTime() - job.startTime.getTime() : null;
  } else if (job.status === 'failed') {
    response.success = false;
    response.error = job.error;
    response.message = 'Music generation failed';
  } else if (job.status === 'processing') {
    response.message = 'Music generation in progress...';
    response.elapsedTime = Date.now() - job.startTime.getTime();
  } else {
    response.message = 'Music generation queued';
  }
  
  res.json(response);
});

// List all jobs
app.get('/jobs', (req, res) => {
  const jobList = Array.from(jobs.values()).map(job => ({
    id: job.id,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    styleCard: job.styleCard,
    audioFile: job.audioFile,
    error: job.error,
    directionsCount: job.directions.length,
    dummyMode: job.dummyMode
  }));
  
  // Sort by start time (newest first)
  jobList.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  
  res.json({
    jobs: jobList,
    total: jobList.length,
    pending: jobList.filter(j => j.status === 'pending').length,
    processing: jobList.filter(j => j.status === 'processing').length,
    completed: jobList.filter(j => j.status === 'completed').length,
    failed: jobList.filter(j => j.status === 'failed').length
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mcpServer: 'http://localhost:3000',
    activeJobs: jobs.size
  });
});

// List available audio files with metadata
app.get('/audio-files', async (req, res) => {
  try {
    const metadataDir = path.join(serverDir, 'generated-music', 'metadata');
    const audioDir = path.join(serverDir, 'generated-music', 'audio');
    
    console.log('🔍 Debug paths:');
    console.log('  serverDir:', serverDir);
    console.log('  audioDir:', audioDir);
    console.log('  metadataDir:', metadataDir);
    
    // Check if directories exist
    try {
      await fs.access(audioDir);
      await fs.access(metadataDir);
      console.log('✅ Both new directories exist');
    } catch (dirError) {
      console.log('❌ New directory structure not found, falling back to old structure');
      console.log('  Error:', dirError);
      
      // Fall back to old structure if new structure doesn't exist
      const files = await fs.readdir(serverDir);
      const musicFiles = files.filter(file => 
        file.startsWith('music_') && file.endsWith('.mp3')
      );
      
      console.log('📁 Found old-structure files:', musicFiles);
      
      const fileDetails = await Promise.all(
        musicFiles.map(async file => {
          const stats = await fs.stat(path.join(serverDir, file));
          return {
            filename: file,
            url: `/audio/${file}`,
            size: stats.size,
            created: stats.mtime,
            sizeKB: Math.round(stats.size / 1024),
            title: file.replace('music_', '').replace('.mp3', ''),
            styleCard: {
              songTitle: file.replace('music_', '').replace('.mp3', ''),
              genre: 'Generated Music',
              artistName: 'AI Composer',
              mood: ['Generated']
            }
          };
        })
      );
      
      fileDetails.sort((a, b) => b.created.getTime() - a.created.getTime());
      return res.json({ files: fileDetails, total: fileDetails.length });
    }
    
    // New structure: read from organized folders
    const audioFiles = await fs.readdir(audioDir);
    const musicFiles = audioFiles.filter(file => 
      file.startsWith('music_') && file.endsWith('.mp3')
    );
    
    console.log('🎵 Found audio files in new structure:', musicFiles);
    
    const fileDetails = await Promise.all(
      musicFiles.map(async file => {
        const audioStats = await fs.stat(path.join(audioDir, file));
        const metadataFile = file.replace('.mp3', '.json');
        const metadataPath = path.join(metadataDir, metadataFile);
        
        console.log(`📋 Processing ${file}, looking for metadata at:`, metadataPath);
        
        // Try to load metadata
        let metadata = null;
        let routeGraphics = null;
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          metadata = JSON.parse(metadataContent);
          console.log(`✅ Loaded metadata for ${file}`);
          
          // Try to load route graphics if referenced
          if (metadata.routeGraphicsFile) {
            const routeGraphicsPath = path.join(routeGraphicsDir, metadata.routeGraphicsFile);
            try {
              const routeGraphicsContent = await fs.readFile(routeGraphicsPath, 'utf8');
              routeGraphics = JSON.parse(routeGraphicsContent);
              console.log(`🗺️ Loaded route graphics for ${file}`);
            } catch (routeErr) {
              console.warn(`❌ No route graphics file found for ${file}:`, routeErr instanceof Error ? routeErr.message : String(routeErr));
            }
          }
          
        } catch (err) {
          console.warn(`❌ No metadata found for ${file}:`, err instanceof Error ? err.message : String(err));
        }
        
        return {
          filename: file,
          url: `/audio/${file}`,
          size: audioStats.size,
          created: audioStats.mtime,
          sizeKB: Math.round(audioStats.size / 1024),
          title: metadata?.songTitle || file.replace('music_', '').replace('.mp3', ''),
          styleCard: metadata?.styleCard || {
            songTitle: file.replace('music_', '').replace('.mp3', ''),
            genre: 'Generated Music',
            artistName: 'AI Composer',
            mood: ['Generated']
          },
          directions: metadata?.directions || [],
          metadata: metadata,
          routeGraphics: routeGraphics, // Include loaded route graphics
          routeGraphicsUrl: routeGraphics ? `/route-graphics/${metadata.routeGraphicsFile}` : null
        };
      })
    );
    
    fileDetails.sort((a, b) => b.created.getTime() - a.created.getTime());
    
    res.json({
      files: fileDetails,
      total: fileDetails.length
    });
  } catch (error) {
    console.error('Error listing audio files:', error);
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
    directTestUrl: `http://localhost:${PORT}/orchestrate`,
    statusCheckUrl: `http://localhost:${PORT}/status/{jobId}`,
    jobsListUrl: `http://localhost:${PORT}/jobs`
  });
});

// Start the server
function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Directions2Music MCP Client running on http://localhost:${PORT}`);
    console.log(`📁 Audio files served from: ${serverDir}`);
    console.log(`🎵 Audio endpoint: http://localhost:${PORT}/audio/`);
    console.log(`🎯 Start job: POST http://localhost:${PORT}/orchestrate`);
    console.log(`📊 Check status: GET http://localhost:${PORT}/status/:jobId`);
    console.log(`📋 List jobs: GET http://localhost:${PORT}/jobs`);
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