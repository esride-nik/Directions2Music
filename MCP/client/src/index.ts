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
  short: boolean;
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
        short: job.short
      }
    });
    
    console.log(`✅ [${jobId}] Music generation completed`);
    
    // Step 3: Find the generated audio file
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for file system
    const audioFile = await findLatestMusicFile();
    
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
    const { directions, dummyMode = false, short = false } = req.body;
    
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
      short
    };
    
    jobs.set(jobId, job);
    
    console.log(`📋 Created job ${jobId} for ${directions.length} directions (dummy: ${dummyMode}, short: ${short})`);
    
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
      estimatedTime: dummyMode ? '5-10 seconds' : (short ? '30-60 seconds' : '2-5 minutes')
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
    dummyMode: job.dummyMode,
    short: job.short
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
    directTestUrl: `http://localhost:${PORT}/orchestrate`,
    statusCheckUrl: `http://localhost:${PORT}/status/{jobId}`,
    jobsListUrl: `http://localhost:${PORT}/jobs`
  });
});

// Start the server
function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Directions2Music Client Server running on http://localhost:${PORT}`);
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