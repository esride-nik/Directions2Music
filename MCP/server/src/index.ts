import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { StyleCard, styleCardSchema, findStyleInputSchema, generateMusicInputSchema } from "./schemas.js";
import { compositionPlan } from "@elevenlabs/elevenlabs-js/api/resources/music/index.js";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyC9yaQUsLTxUEyxv6i8M1IcMPkIWJto6RY",
});
const elevenLabsApiKey = "sk_15d6f23c93bf4d768f210fbbfc07f68105f0870aa8aa0198";

const styleCard = styleCardSchema;

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
    Return JSON: { bpm, key, genre, instrumentation[], mood[], description }.
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
    outputSchema: styleCard,
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
    outputSchema: styleCard,
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

// generate-music with ElevenLabs
server.registerTool(
  "generate-music",
  {
    title: "Generate Music",
    description:
      "Generate music based on the provided routing directions and style card using the ElevenLabs Music API.",
    inputSchema: generateMusicInputSchema,
    outputSchema: styleCard,
  },
  async (args: any, extra: any) => {
    // narrow & validate at runtime
    const composition_plan = args?.composition_plan || undefined;
    const prompt = args?.prompt ? String(args.prompt) : "";
    const music_length_ms = args?.music_length_ms ? Number(args.music_length_ms) : undefined;
    const output_format = args?.output_format || "mp3_44100_128";
    const model_id = args?.model_id || "music_v1";
    const force_instrumental = Boolean(args?.force_instrumental);
    const store_for_inpainting = Boolean(args?.store_for_inpainting);

    console.log("Generate music with ElevenLabs API", {
      composition_plan,
      prompt: prompt.substring(0, 50),
      music_length_ms,
      output_format,
      model_id,
      force_instrumental,
      store_for_inpainting,
    });

    // Placeholder implementation - replace with actual logic to call ElevenLabs API
    let card = {} as StyleCard;
    try {

      // Call ElevenLabs API at https://api.elevenlabs.io/v1/music/detailed with the parameters above
      
      const client = new ElevenLabsClient({
          environment: "https://api.elevenlabs.io",
          apiKey: elevenLabsApiKey,
      });
      const finalCompositionPlan = await client.music.compositionPlan.create({
          prompt: prompt,
          sourceCompositionPlan: composition_plan
      });
      console.log("Final Composition Plan:", finalCompositionPlan);
      const musicResponse = await client.music.composeDetailed.apply({
        compositionPlan: finalCompositionPlan
      });

      // const musicRequest = {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "xi-api-key": elevenLabsApiKey,
      //   },
      //   body: JSON.stringify({
      //     composition_plan,
      //     // prompt,
      //     // music_length_ms,
      //     // output_format,
      //     // model_id,
      //     force_instrumental
      //   })
      // }
      // console.log("ElevenLabs music generation request:", JSON.stringify(musicRequest));
      // const musicResponse = await fetch("https://api.elevenlabs.io/v1/music/detailed", musicRequest);

      console.log("ElevenLabs music generation response status:", JSON.stringify(musicResponse));

      // TODO: adjust tool output according to model output
      return {
        content: [
          {
            type: "text",
            text: `Music generation requested: "${prompt.substring(0, 50)}..."`,
          },
        ],
        structuredContent: card as any,
      };
    } catch (error) {
      console.error("Error generating music:", error);
      return {
        content: [
          {
            type: "text",
            text: "Error generating music",
          },
        ],
        structuredContent: {} as any,
      };
    }
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
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
