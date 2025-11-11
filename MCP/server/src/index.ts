import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { string } from "zod/v4";

const server = new McpServer({
  name: "directions2Music_mcp_server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.registerTool(
  'find-musical-style',
  {
    title: 'Find Musical Style',
    description: 'Find a musical style based on given routing directions by drawing cultural references from the location.',
    inputSchema: z.array(z.string()).describe('An array of routing directions as strings.'),
    outputSchema: z.object({
      bpm: z.number().describe('Beats per minute for the musical style.'),
      key: z.string().describe('The musical key for the style (e.g., C Major, A Minor).'),
      genre: z.string().describe('The genre of the musical style.'),
      instrumentation: z.array(z.string()).describe('List of instruments used in the musical style.'),
      mood: z.array(z.string()).describe('Moods evoked by the musical style.'),
      description: z.string().describe('A brief description of the musical style.'),
    }).describe('A musical style card that matches the given directions.'),
  },
  async (directions: string[]) => {
    // Placeholder implementation - replace with actual logic to determine musical style
    return directions.length%2===0 ? {
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
      mood: "adventurous, journey",
      description: "Saharan travel groove with modern beat; steady 4/4."
    };
  }
)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});