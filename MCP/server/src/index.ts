import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { StyleCard, styleCardSchema, findStyleInputSchema, ElevenLabsGenerateMusicInput, generateMusicInputSchema, GenerateMusicInput, FindStyleInput, generateMusicOutputSchema, GenerateMusicOutput } from "./schemas.js";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to save track metadata
async function saveTrackMetadata(
  trackId: string,
  songTitle: string | undefined,
  directions: string[],
  styleCard: StyleCard,
  timestamp: string,
  audioFile: string,
  metadataFile: string,
  routeGraphics?: {
    directionLines: any[],
    directionPoints: any[],
    stops: any[]
  }
) {
  const routeGraphicsFile = routeGraphics ? 
    `./generated-music/route-graphics/${trackId}.json` : null;

  const metadata = {
    trackId,
    songTitle: songTitle || `Generated Track ${timestamp}`,
    audioFile: path.basename(audioFile),
    timestamp,
    styleCard: {
      songTitle: songTitle || styleCard.songTitle || `Generated Track ${timestamp}`,
      genre: styleCard.genre || 'AI Generated Music',
      artistName: 'AI Composer', // This is our custom addition
      mood: styleCard.mood || ['Generated'],
      description: styleCard.description || `Generated music based on navigation directions`
    },
    directions: directions || [],
    routeGraphicsFile: routeGraphicsFile ? path.basename(routeGraphicsFile) : null, // Reference to separate route graphics file
    composition: {
      durationMs: 120000, // Default duration
      style: "AI generated music based on geographic and cultural context"
    },
    generationMetadata: {
      elapsedTimeMs: Date.now(), // Will be updated by caller if needed
      timestamp: new Date().toISOString()
    }
  };

  try {
    // Ensure the metadata directory exists
    const metadataDir = path.dirname(metadataFile);
    await fs.mkdir(metadataDir, { recursive: true });
    
    // Save main metadata
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`📋 Metadata saved: ${metadataFile}`);
    
    // Save route graphics to separate file if provided
    if (routeGraphics && routeGraphicsFile) {
      const routeGraphicsDir = path.dirname(routeGraphicsFile);
      await fs.mkdir(routeGraphicsDir, { recursive: true });
      
      await fs.writeFile(routeGraphicsFile, JSON.stringify(routeGraphics, null, 2));
      console.log(`🗺️ Route graphics saved: ${routeGraphicsFile}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to save metadata or route graphics: ${error}`);
  }
}

/*********************
** Load configuration
**********************/
const configPath = new URL("../config.json", import.meta.url);
const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const ai = new GoogleGenAI({
  apiKey: config.googleGenAIApiKey,
});
const elevenLabsApiKey = config.elevenLabsApiKey;

const server = new McpServer({
  name: "directions2Music_mcp_server",
  version: "1.0.0",
});


/***********************
** Find musical style **
************************/

// query Gemini LLM to get StyleCard from directions
const getStyleCardFromGemini = async (lyricsLines: string[]): Promise<StyleCard> => {
  const prompt = `
    You are a music style selector. Infer locale and style from these lyric lines (routing directions).
    Return JSON: { bpm, key, genre, instrumentation[], mood[], description, songTitle }.
    Lyrics:
    ${lyricsLines.join("\n")}
  `;

  // This is the LLM call => commented out for debugging
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: zodToJsonSchema(z.object(styleCardSchema)),
    },
  });

  const jsonResponse =
    response.text && response.text.length > 0
      ? (z.object(styleCardSchema).parse(JSON.parse(response.text)) as StyleCard)
      : ({} as StyleCard);
  return jsonResponse;
};

// get dummy StyleCard for testing
const getDummyStyleCard = async (): Promise<StyleCard> => {
    // Placeholder implementation - replace with actual logic to determine musical style
    // Read local dummy responses JSON file (server-side filesystem)
    try {
      const dummyPath = new URL(
        "../dummyData/dummyResponses_musicalStyle.json",
        import.meta.url
      );
      const dummyText = await fs.readFile(dummyPath, "utf8");
      const dummyResponses = JSON.parse(dummyText);
      // console.log("Fetched dummy responses", dummyResponses?.length ?? null, dummyResponses);
      const randomId = Math.floor(Math.random()*dummyResponses?.length);
      const card = dummyResponses[randomId];
      console.log(`Fetched dummy Style Card no.${randomId}:`, card);
      return card;
    } catch (e) {
      console.warn("Could not read dummy responses file:", e);
      return {} as StyleCard;
    }
};

// find-musical-style with Gemini LLM
server.registerTool(
  "find-musical-style",
  {
    title: "Find Musical Style",
    description:
      "Find a musical style based on given routing directions by drawing cultural references from the location.",
    inputSchema: findStyleInputSchema,
    outputSchema: styleCardSchema,
  },
  async (args: FindStyleInput) => {
    // narrow & validate at runtime
    const directions = Array.isArray(args?.directions)
      ? args.directions.map(String)
      : [];
    const dummyMode = args && args.dummyMode ? Boolean(args.dummyMode) : false;

    // determine musical style
    let card = {} as StyleCard;
    try {

      // query Gemini LLM (or get dummy data)
      card = dummyMode ? await getDummyStyleCard() : await getStyleCardFromGemini(directions);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(card),
          },
        ],
        structuredContent: card as any,
      };
    } catch (error) {
      console.error("Error generating Style Card:", error);
      return {
        content: [
          {
            type: "text",
            text: "Error generating Style Card",
          },
        ],
        structuredContent: {} as StyleCard,
      };
    }
  }
);


/*******************
** Generate music **
********************/

// helper to call ElevenLabs Music API to generate music
const generateMusicElevenLabs = async (
  elevenLabsGenerateMusicInput: ElevenLabsGenerateMusicInput, 
  description?: string, 
  songTitle?: string,
  directions?: string[],
  styleCard?: StyleCard,
  routeGraphics?: any // Route graphics data from the frontend
) => {
    // Create ElevenLabs API client
    const client = new ElevenLabsClient({
        environment: "https://api.elevenlabs.io",
        apiKey: elevenLabsApiKey,
    });
    let finalCompositionPlan;
    let musicResponse;
    let audioFilename = ""; // Initialize filename variable at function scope

    console.log("+++ Initial Composition Plan: +++\n", JSON.stringify(elevenLabsGenerateMusicInput.compositionPlan));

    try {
      finalCompositionPlan = await client.music.compositionPlan.create({
        prompt: `Create hilariously cliché music for navigation directions. 
              Keep the original text EXACTLY as provided - do not change or poeticize the lyrics. 
              Do not add instrumental intro or outro sections. 
              Focus only on the vocal section with the provided directions.
              Make the musical arrangement as stereotypical and over-the-top as possible for this style.
              Use the most obvious, exaggerated musical tropes and clichés that would make people smile.
              Think cheesy tourist music, overly dramatic folk ballads, or comically intense travel anthems.
              Style: ${description}. 
              Original directions: ${elevenLabsGenerateMusicInput.compositionPlan?.sections[0].lines.join(', ')}`,
        sourceCompositionPlan: elevenLabsGenerateMusicInput.compositionPlan
      });
      // add original positiveGlobalStyles to final plan
      finalCompositionPlan.positiveGlobalStyles = [
        ...new Set([
            "vocals", 
            "clear lyrics",
            "sung in local dialect",
          ...finalCompositionPlan.positiveGlobalStyles,
          ...elevenLabsGenerateMusicInput.compositionPlan?.positiveGlobalStyles || []
        ])
      ];
      // add original positiveGlobalStyles to positiveGlobalStyles of each section of final plan
      finalCompositionPlan.sections = finalCompositionPlan.sections.map((section, index) => ({
        ...section,
        positiveLocalStyles: [
          ...new Set([
            "vocals", 
            "clear lyrics",
            "sung in local dialect",
            ...section.positiveLocalStyles,
            ...(elevenLabsGenerateMusicInput.compositionPlan?.sections[index]?.positiveLocalStyles || [])
          ])
        ]
      }));
      // add negative styles to avoid instrumental / no vocals
      finalCompositionPlan.negativeGlobalStyles = ["instrumental", "no vocals"];
      finalCompositionPlan.sections = finalCompositionPlan.sections.map((section) => ({
        ...section,
        negativeLocalStyles: ["instrumental", "no vocals"]
      }));
      console.log("+++ Final Composition Plan: +++\n", JSON.stringify(finalCompositionPlan));
    } catch (error) {
      console.error("Error generating final composition plan:", error);
      return error;
    }

  try {
      musicResponse = await client.music.composeDetailed({
        compositionPlan: finalCompositionPlan
      });

      console.log("✅ ElevenLabs music generation succeeded");
      
      // Create filename with new folder structure
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize songTitle to remove characters that aren't valid in filenames
      const sanitizedTitle = songTitle 
        ? songTitle.substring(0, 20).replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
        : '';
      const trackId = sanitizedTitle 
        ? `music_${sanitizedTitle}_${timestamp}` 
        : `music_${timestamp}`;
      const audioFile = `./generated-music/audio/${trackId}.mp3`;
      const metadataFile = `./generated-music/metadata/${trackId}.json`;
      audioFilename = `${trackId}.mp3`; // Set the filename for return
      
      let audioSaved = false;

      // Method 1: Check if it's an async iterable (ReadableStream)
      if (musicResponse && typeof (musicResponse as any)[Symbol.asyncIterator] === 'function') {
        console.log("📦 Response is a stream, saving directly...");
        const chunks: Buffer[] = [];
        for await (const chunk of musicResponse as any) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);
        await fs.writeFile(audioFile, audioBuffer);
        console.log(`✅ Audio file saved (stream): ${audioFile} (${audioBuffer.length} bytes)`);
        audioSaved = true;
        
        // Save metadata
        await saveTrackMetadata(trackId, songTitle, directions || [], styleCard || {} as StyleCard, timestamp, audioFile, metadataFile, routeGraphics);
      }
      
      // Method 2: Check if it's a Buffer
      else if (Buffer.isBuffer(musicResponse)) {
        console.log("📦 Response is a buffer, saving directly...");
        await fs.writeFile(audioFile, musicResponse);
        console.log(`✅ Audio file saved (buffer): ${audioFile} (${(musicResponse as Buffer).length} bytes)`);
        audioSaved = true;
        
        // Save metadata
        await saveTrackMetadata(trackId, songTitle, directions || [], styleCard || {} as StyleCard, timestamp, audioFile, metadataFile, routeGraphics);
      }
      
      // Method 3: Try to access .body property (common in HTTP responses)
      else if ((musicResponse as any)?.body) {
        console.log("📦 Response has .body property, extracting...");
        try {
          const chunks: Buffer[] = [];
          const body = (musicResponse as any).body;
          
          if (typeof body[Symbol.asyncIterator] === 'function') {
            for await (const chunk of body) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
          } else if (Buffer.isBuffer(body)) {
            chunks.push(body);
          }
          
          if (chunks.length > 0) {
            const audioBuffer = Buffer.concat(chunks);
            await fs.writeFile(audioFile, audioBuffer);
            console.log(`✅ Audio file saved (body): ${audioFile} (${audioBuffer.length} bytes)`);
            audioSaved = true;
            
            // Save metadata
            await saveTrackMetadata(trackId, songTitle, directions || [], styleCard || {} as StyleCard, timestamp, audioFile, metadataFile, routeGraphics);
          }
        } catch (bodyErr) {
          console.warn("⚠️  Could not extract from .body:", bodyErr);
        }
      }
      
      // Method 4: Check if it has .audio property (ElevenLabs specific format)
      else if ((musicResponse as any)?.audio) {
        console.log("📦 Response has .audio property, extracting...");
        try {
          const audioData = (musicResponse as any).audio;
          let audioBuffer: Buffer;
          
          if (Buffer.isBuffer(audioData)) {
            audioBuffer = audioData;
          } else if (typeof audioData[Symbol.asyncIterator] === 'function') {
            const chunks: Buffer[] = [];
            for await (const chunk of audioData) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            audioBuffer = Buffer.concat(chunks);
          } else if (typeof audioData === 'string') {
            // Might be base64 encoded
            audioBuffer = Buffer.from(audioData, 'base64');
          } else if (audioData && typeof audioData === 'object' && audioData.type === 'Buffer' && Array.isArray(audioData.data)) {
            // Serialized Buffer format from JSON.stringify
            audioBuffer = Buffer.from(audioData.data);
          } else if (audioData instanceof Uint8Array) {
            audioBuffer = Buffer.from(audioData);
          } else {
            console.warn("⚠️  Unknown audio data type:", typeof audioData);
            throw new Error("Unknown audio data type");
          }
          
          await fs.writeFile(audioFile, audioBuffer);
          console.log(`✅ Audio file saved (audio property): ${audioFile} (${audioBuffer.length} bytes)`);
          audioSaved = true;
          
          // Save metadata
          await saveTrackMetadata(trackId, songTitle, directions || [], styleCard || {} as StyleCard, timestamp, audioFile, metadataFile, routeGraphics);
        } catch (audioErr) {
          console.warn("⚠️  Could not extract from .audio:", audioErr);
        }
      }
      
      if (!audioSaved) {
        console.warn("⚠️  Could not save audio file - response type unknown");
        console.log("Response type:", typeof musicResponse);
        console.log("Response keys:", Object.keys(musicResponse || {}));
        
        // Fallback: Save full response for analysis
        console.log("💾 Saving full response for analysis...");
        try {
          const debugFile = `./music_response_debug_${timestamp}.json`;
          const responseAnalysis = {
            timestamp,
            responseType: typeof musicResponse,
            isBuffer: Buffer.isBuffer(musicResponse),
            isStream: musicResponse && typeof (musicResponse as any)[Symbol.asyncIterator] === 'function',
            hasBody: !!(musicResponse as any)?.body,
            keys: Object.keys(musicResponse || {}),
            constructorName: musicResponse?.constructor?.name || 'unknown',
            stringified: JSON.stringify(musicResponse, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (Buffer.isBuffer(value)) {
                  return {
                    _type: 'Buffer',
                    length: value.length,
                    hexStart: value.slice(0, 100).toString('hex')
                  };
                }
                if (value instanceof ReadableStream || value[Symbol.asyncIterator]) {
                  return { _type: 'Stream' };
                }
              }
              return value;
            }, 2)
          };
          
          await fs.writeFile(debugFile, JSON.stringify(responseAnalysis, null, 2));
          console.log(`✅ Debug response saved to: ${debugFile}`);
        } catch (debugErr) {
          console.error("Could not save debug response:", debugErr);
        }
      }
      
    } catch (error) {
      console.error("❌ Error generating music:", error);
      
      // Even on error, try to save error details
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const errorFile = `./music_error_${timestamp}.json`;
        const errorDetails = {
          timestamp,
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error),
          musicResponse: musicResponse ? {
            type: typeof musicResponse,
            keys: Object.keys(musicResponse as any)
          } : null
        };
        
        await fs.writeFile(errorFile, JSON.stringify(errorDetails, null, 2));
        console.log(`📝 Error details saved to: ${errorFile}`);
      } catch (saveErr) {
        console.error("Could not save error details:", saveErr);
      }
      
      return error;
    }
    
    // Return a schema-compliant response (files are already saved)
    // Use the actual filename that was generated for saving
    return {
      json: {
        compositionPlan: {
          positiveGlobalStyles: ["generated"],
          negativeGlobalStyles: [],
          sections: [{
            sectionName: "Generated Music",
            positiveLocalStyles: ["real-generation"],
            negativeLocalStyles: [],
            durationMs: 30000,
            lines: directions || []
          }]
        },
        songMetadata: {
          title: songTitle || "Generated Music",
          description: description || "Music generated from route directions",
          genres: ["Generated"],
          languages: ["en"],
          isExplicit: false
        }
      },
      audio: {
        type: "Buffer" as const,
        data: [] // Empty for real mode - file is saved to disk
      },
      filename: audioFilename
    };
}

// get dummy ElevenLabs response for testing
const getDummyMusicResponse = async () => {
    try {
      const dummyPath = new URL(
        "../dummyData/dummyResponses_generateMusic_short.json",
        // "../dummyData/dummyResponses_generateMusic.json",
        import.meta.url
      );
      const dummyText = await fs.readFile(dummyPath, "utf8");
      const dummyResponse = JSON.parse(dummyText);
      console.log("📦 Loaded dummy ElevenLabs response:", {
        hasAudio: !!dummyResponse.audio,
        hasJson: !!dummyResponse.json,
        hasFilename: !!dummyResponse.filename,
        audioDataLength: dummyResponse.audio?.data?.length
      });
      return dummyResponse;
    } catch (e) {
      console.warn("Could not read dummy music response file:", e);
      return {};
    }
};

// get dummy music response by returning an existing file (for dummy mode)
const getDummyMusicWithExistingFile = async () => {
  try {
    const musicDir = path.join(process.cwd(), 'generated-music', 'audio');
    
    // Try to find any existing mp3 files
    const files = await fs.readdir(musicDir);
    const mp3Files = files.filter(file => file.endsWith('.mp3'));
    
    if (mp3Files.length === 0) {
      console.warn("⚠️ No existing audio files found for dummy mode, falling back to generated response");
      return await getDummyMusicResponse();
    }
    
    // Pick a random existing file (or the first one)
    const selectedFile = mp3Files[Math.floor(Math.random() * mp3Files.length)];
    console.log(`🎵 Dummy mode: Using existing file ${selectedFile}`);
    
    // Return a response that matches GenerateMusicOutput schema but indicates existing file
    return {
      json: {
        compositionPlan: {
          positiveGlobalStyles: ["dummy", "existing-file"],
          negativeGlobalStyles: [],
          sections: [{
            sectionName: "Existing Music",
            positiveLocalStyles: ["reused"],
            negativeLocalStyles: [],
            durationMs: 30000,
            lines: ["Using existing audio file for demo"]
          }]
        },
        songMetadata: {
          title: "Existing File (Dummy Mode)",
          description: `Reusing existing file: ${selectedFile}`,
          genres: ["Demo"],
          languages: ["en"],
          isExplicit: false
        }
      },
      audio: {
        type: "Buffer",
        data: [] // Empty for dummy mode - we'll use existing file
      },
      filename: selectedFile,
      existingFile: true // Custom flag to indicate this is an existing file
    };
  } catch (error) {
    console.warn("⚠️ Could not access existing files for dummy mode:", error);
    return await getDummyMusicResponse(); // Fallback to original dummy response
  }
};

// concatenate lines to fit maxLines for ElevenLabs composition plan
const shortenDirectionsInput = (directionsInput: string[], maxLines: number): string[] => {
  let lineCount = 0;
  while (directionsInput.length > maxLines) {
    directionsInput[lineCount] = `${directionsInput[lineCount]}\n${directionsInput[lineCount+1]}`;
    directionsInput.splice(lineCount+1, 1);
    lineCount++;
  }
  return directionsInput;
}

// helper to prepare ElevenLabs music generation input, meeting some API-specific constraints
const getElevenLabsInitialCompositionPlan = (styleCard: StyleCard, directionsInput: string[]): ElevenLabsGenerateMusicInput => {
  const lines = directionsInput.length <= 30 ? directionsInput : shortenDirectionsInput(directionsInput, 30);
  const calcLengthFromLines = lines.length * 5000;
  console.log(`getElevenLabsInitialCompositionPlan: Original directions length ${directionsInput.length}. Using ${lines.length} lines for composition plan, calculated length ${calcLengthFromLines} ms.`, JSON.stringify(lines));
  return {
    forceInstrumental: false,
    compositionPlan: {
        positiveGlobalStyles: [styleCard.genre, ...styleCard.instrumentation, ...styleCard.mood],
        negativeGlobalStyles: [],
        sections: [{
            sectionName: styleCard.songTitle || directionsInput[0],
            positiveLocalStyles: [styleCard.genre, ...styleCard.instrumentation, ...styleCard.mood],
            negativeLocalStyles: [],
            durationMs: calcLengthFromLines <= 120000 ? calcLengthFromLines : 120000,
            lines: lines
        }]
    }
  };
}

// generate-music
server.registerTool(
  "generate-music",
  {
    title: "Generate Music",
    description:
      "Generate music based on the provided routing directions and style card using the ElevenLabs Music API.",
    inputSchema: generateMusicInputSchema,
    outputSchema: generateMusicOutputSchema,
  },
  async (args: GenerateMusicInput) => {
    // narrow & validate at runtime
    const styleCard = args?.styleCard as StyleCard;
    const lyrics = Array.isArray(args?.lyrics)
      ? args.lyrics.map(String)
      : [];
    const dummyMode = args && args.dummyMode ? Boolean(args.dummyMode) : false;
    const routeGraphics = args?.routeGraphics;

    // ElevenLabs music generation call
    const musicResponse = dummyMode ? 
      await getDummyMusicWithExistingFile() : 
      await generateMusicElevenLabs(
        getElevenLabsInitialCompositionPlan(styleCard, lyrics),
        styleCard.description, 
        styleCard.songTitle,
        lyrics, // These are actually the directions
        styleCard,
        routeGraphics // Pass route graphics to generateMusicElevenLabs
      );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(musicResponse),
        },
      ],
      structuredContent: musicResponse as GenerateMusicOutput,
    };
  }
);


/******************
 ** Server runtime
 ******************/

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Demo MCP Server running under /mcp, responding to POST requests.");
});

const port = parseInt(process.env.PORT || "3000");
app
  .listen(port, () => {
    console.log(`🚀 Directions2Music MCP Server running on http://localhost:${port}`);
  }).on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
