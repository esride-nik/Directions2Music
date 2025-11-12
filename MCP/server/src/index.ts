import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyC9yaQUsLTxUEyxv6i8M1IcMPkIWJto6RY",
});

interface StyleCard {
  bpm: number;
  key: string;
  genre: string;
  instrumentation: string[];
  mood: string[];
  description: string;
}

const styleCard = {
  bpm: z.number().describe("Beats per minute for the musical style."),
  key: z
    .string()
    .describe("The musical key for the style (e.g., C Major, A Minor)."),
  genre: z.string().describe("The genre of the musical style."),
  instrumentation: z
    .array(z.string())
    .describe("List of instruments used in the musical style."),
  mood: z.array(z.string()).describe("Moods evoked by the musical style."),
  description: z.string().describe("A brief description of the musical style."),
};

const server = new McpServer({
  name: "directions2Music_mcp_server",
  version: "1.0.0",
});

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

server.registerTool(
  "find-musical-style",
  {
    title: "Find Musical Style",
    description:
      "Find a musical style based on given routing directions by drawing cultural references from the location.",
    inputSchema: {
      directions: z.array(
        z.string().describe("An array of routing directions as strings.")
      ),
    },
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
        structuredContent: card,
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
        structuredContent: {},
      };
    }
  }
);

server.registerTool(
  "dummy-find-musical-style",
  {
    title: "DUMMY Find Musical Style",
    description:
      "Find a musical style based on given routing directions by drawing cultural references from the location.",
    inputSchema: {
      directions: z.array(
        z.string().describe("An array of routing directions as strings.")
      ),
    },
    outputSchema: {
      bpm: z.number().describe("Beats per minute for the musical style."),
      key: z
        .string()
        .describe("The musical key for the style (e.g., C Major, A Minor)."),
      genre: z.string().describe("The genre of the musical style."),
      instrumentation: z
        .array(z.string())
        .describe("List of instruments used in the musical style."),
      mood: z.array(z.string()).describe("Moods evoked by the musical style."),
      description: z
        .string()
        .describe("A brief description of the musical style."),
    },
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
      structuredContent: card,
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
  })
  .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
