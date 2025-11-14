import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { StyleCard, styleCardSchema, findStyleInputSchema, ElevenLabsGenerateMusicInput, generateMusicInputSchema, GenerateMusicInput, CompositionPlan } from "./schemas.js";

const ai = new GoogleGenAI({
  apiKey: "YOUR_GOOGLE_API_KEY",
});
const elevenLabsApiKey = "YOUR_ELEVENLABS_API_KEY";

const server = new McpServer({
  name: "directions2Music_mcp_server",
  version: "1.0.0",
});

/***********************
** Find musical style **
************************/

const getStyleCard = async (lyricsLines: string[]): Promise<StyleCard> => {
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
      responseJsonSchema: zodToJsonSchema(z.object(styleCard)),
    },
  });

  const jsonResponse =
    response.text && response.text.length > 0
      ? (z.object(styleCard).parse(JSON.parse(response.text)) as StyleCard)
      : ({} as StyleCard);
  return jsonResponse;
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
  async (args: any, extra: any) => {
    // narrow & validate at runtime
    const directions = Array.isArray(args?.directions)
      ? args.directions.map(String)
      : [];

    console.log("directions length", directions.length);

    // Placeholder implementation - replace with actual logic to determine musical style
    let card = {} as StyleCard;
    try {
      console.log("Calling getStyleCard with directions");
      card = await getStyleCard(directions);
      console.log("Generated Style Card:", card);
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

// dummy-find-musical-style (no LLM, local dummy data)
server.registerTool(
  "dummy-find-musical-style",
  {
    title: "DUMMY Find Musical Style",
    description:
      "Find a musical style based on given routing directions by drawing cultural references from the location.",
    inputSchema: findStyleInputSchema,
    outputSchema: styleCardSchema,
  },
  async (args: any, extra: any) => {
    // narrow & validate at runtime
    const directions = Array.isArray(args?.directions)
      ? args.directions.map(String)
      : [];

    console.log("directions length", directions.length);

    let card = {} as StyleCard;

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
      card = dummyResponses[randomId];
      console.log(`Fetched dummy Style Card no.${randomId}:`, card);
    } catch (e) {
      console.warn("Could not read dummy responses file:", e);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(card),
        },
      ],
      structuredContent: card as any,
    };
  }
);


/*******************
** Generate music **
********************/

const generateMusicElevenLabs = async (elevenLabsGenerateMusicInput: ElevenLabsGenerateMusicInput, songTitle?: string) => {
    // Create ElevenLabs API client
    const client = new ElevenLabsClient({
        environment: "https://api.elevenlabs.io",
        apiKey: elevenLabsApiKey,
    });
    let finalCompositionPlan;
    let musicResponse;

    try {
      finalCompositionPlan = await client.music.compositionPlan.create({
          prompt: elevenLabsGenerateMusicInput.prompt ?? elevenLabsGenerateMusicInput.compositionPlan?.sections[0].lines[0] ?? "",
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

      console.log("ElevenLabs music generation response:", musicResponse);
      
      // Save the response to a file for inspection
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const responseFile = songTitle ? `./music_response_${songTitle.substring(0, 20)}_${timestamp}.json` : `./music_response_${timestamp}.json`;
      await fs.writeFile(responseFile, JSON.stringify(musicResponse, null, 2));
      console.log(`Music response saved to: ${responseFile}`);
      
      // Try to save the audio if it's a stream
      if (musicResponse && typeof musicResponse === 'object') {
        const audioFile = songTitle ? `./generated_music_${songTitle.substring(0, 20)}_${timestamp}.mp3` : `./generated_music_${timestamp}.mp3`;
        try {
          // musicResponse is likely a ReadableStream with audio data
          const chunks: Buffer[] = [];
          const reader = (musicResponse as any)[Symbol.asyncIterator];
          if (reader) {
            for await (const chunk of musicResponse as any) {
              chunks.push(Buffer.from(chunk));
            }
            const audioBuffer = Buffer.concat(chunks);
            await fs.writeFile(audioFile, audioBuffer);
            console.log(`Audio file saved to: ${audioFile}`);
          }
        } catch (streamErr) {
          console.log("Could not read stream as audio:", streamErr);
        }
      }
    } catch (error) {
      console.error("Error generating music:", error);
      return error;
    }
    return musicResponse;
}

// concatenate lines to fit maxLines
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
  const calcLengthFromLines = directionsInput.length * 5000;
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
            lines: directionsInput.length <= 30 ? directionsInput : shortenDirectionsInput(directionsInput, 30)
        }]
    }
  };
}

// generate-music with ElevenLabs
server.registerTool(
  "generate-music",
  {
    title: "Generate Music",
    description:
      "Generate music based on the provided routing directions and style card using the ElevenLabs Music API.",
    inputSchema: generateMusicInputSchema,
    outputSchema: styleCardSchema,
  },
  async (args: GenerateMusicInput, extra: any) => {
    // narrow & validate at runtime
    const styleCard = args?.styleCard as StyleCard;
    const lyrics = Array.isArray(args?.lyrics)
      ? args.lyrics.map(String)
      : [];

    // ElevenLabs music generation call
    console.log("Generate music with ElevenLabs API - before", JSON.stringify(styleCard), lyrics, extra);
    const musicResponse = await generateMusicElevenLabs(getElevenLabsInitialCompositionPlan(styleCard, lyrics), styleCard.songTitle);
    console.log("Generate music with ElevenLabs API - after", JSON.stringify(musicResponse));

    // TODO: adjust tool output according to model output
    return {
      content: [
        {
          type: "text",
          text: `Music generation requested: "${lyrics.slice(0, 50).join(" ")}..."`,
        },
      ],
      structuredContent: musicResponse as any,
    };
  }
);



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
  });
  // .on("error", (error) => {
  //   console.error("Server error:", error);
  //   process.exit(1);
  // });
