import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { StyleCard, styleCardSchema, findStyleInputSchema, ElevenLabsGenerateMusicInput, generateMusicInputSchema, GenerateMusicInput, FindStyleInput, generateMusicOutputSchema, GenerateMusicOutput } from "./schemas.js";

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
const generateMusicElevenLabs = async (elevenLabsGenerateMusicInput: ElevenLabsGenerateMusicInput, description?: string, songTitle?: string) => {
    // Create ElevenLabs API client
    const client = new ElevenLabsClient({
        environment: "https://api.elevenlabs.io",
        apiKey: elevenLabsApiKey,
    });
    let finalCompositionPlan;
    let musicResponse;

    console.log("+++ Initial Composition Plan: +++\n", JSON.stringify(elevenLabsGenerateMusicInput.compositionPlan));

    try {
      finalCompositionPlan = await client.music.compositionPlan.create({
          prompt: description ?? elevenLabsGenerateMusicInput.compositionPlan?.sections[0].lines[0] ?? "",
          sourceCompositionPlan: elevenLabsGenerateMusicInput.compositionPlan
      });
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
      
      // Create filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const audioFile = songTitle 
        ? `./music_${songTitle.substring(0, 20)}_${timestamp}.mp3` 
        : `./music_${timestamp}.mp3`;
      
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
      }
      
      // Method 2: Check if it's a Buffer
      else if (Buffer.isBuffer(musicResponse)) {
        console.log("📦 Response is a buffer, saving directly...");
        await fs.writeFile(audioFile, musicResponse);
        console.log(`✅ Audio file saved (buffer): ${audioFile} (${(musicResponse as Buffer).length} bytes)`);
        audioSaved = true;
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
    return musicResponse;
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

    // ElevenLabs music generation call
    const musicResponse = dummyMode ? await getDummyMusicResponse() : await generateMusicElevenLabs(getElevenLabsInitialCompositionPlan(styleCard, lyrics),styleCard.description, styleCard.songTitle);

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

app.post("/mcp", async (req, res) => {
  // In stateless mode, create a new transport for each request to prevent
  // request ID collisions. Different clients may use the same JSON-RPC request IDs,
  // which would cause responses to be routed to the wrong HTTP connections if
  // the transport state is shared.

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/", (req, res) => {
  res.send("Demo MCP Server running under /mcp, responding to POST requests.");
});

const port = parseInt(process.env.PORT || "3000");
app
  .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
  }).on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
