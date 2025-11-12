import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "YOUR_GOOGLE_API_KEY",
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
  });

  console.log("LLM response", response);

//   // DUMMY
//   const response = {
//     text:
//       "```" +
//       `{
//   "bpm": 110,
//     "Rhythmic",
//     "Contemplative",
//     "Guided",
//     "Journey"
//   ],
//   "description": "A mesmerizing electronic journey across the vast, paved roads of Algeria's Ouargla desert. A steady, propulsive beat anchors a soundscape where atmospheric synthesizers meet the timeless melodies of the Oud and the intricate rhythms of Darbuka. The spoken routing directions are woven in, subtly processed with delays and reverb, transforming the mundane into a hypnotic narrative. This track evokes the feeling of a long, controlled drive through an ancient land, blending modern technology with traditional sounds, creating a mood of contemplative exploration and rhythmic forward motion, always staying on the smooth path."
// }` +
//       "```",
//   };

  const openingBraceIndex = response.text.indexOf("{");
  const closingBraceIndex = response.text.lastIndexOf("}");
  const responseJsonText = closingBraceIndex > openingBraceIndex 
    ? response.text.slice(response.text.indexOf('{'), response.text.lastIndexOf('}') + 1) 
    : response.text;

  console.log("LLM response output_text", responseJsonText);
  return responseJsonText.length > 0
    ? JSON.parse(responseJsonText)
    : ({} as StyleCard);
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

    // Placeholder implementation - replace with actual logic to determine musical style
    const card =
      directions.length % 2 === 0
        ? {
            bpm: 120,
            key: "C Major",
            genre: "Pop",
            instrumentation: ["Guitar", "Drums", "Bass"],
            mood: ["Energetic", "Uplifting"],
            description: "A lively pop style perfect for upbeat journeys.",
          }
        : {
            bpm: 100,
            key: "D minor",
            genre: "North-African desert raï + electronic",
            instrumentation: ["oud", "derbouka", "bass", "synth pad"],
            mood: ["adventurous", "journey"],
            description: "Saharan travel groove with modern beat; steady 4/4.",
          };

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
  }
);

// Simple tool with parameters
server.registerTool(
  "calculate-bmi",
  {
    title: "BMI Calculator",
    description: "Calculate Body Mass Index",
    inputSchema: {
      weightKg: z.number(),
      heightM: z.number(),
    },
    outputSchema: { bmi: z.number() },
  },
  async ({ weightKg, heightM }) => {
    const output = { bmi: weightKg / (heightM * heightM) };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output),
        },
      ],
      structuredContent: output,
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
