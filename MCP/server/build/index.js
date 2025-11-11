"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const server = new mcp_js_1.McpServer({
    name: "directions2Music_mcp_server",
    version: "1.0.0",
});
const inputShape = {
    lines: zod_1.z
        .array(zod_1.z.string())
        .describe("An array of routing directions as strings."),
};
const outputShape = {
    bpm: zod_1.z.number().describe("Beats per minute for the musical style."),
    key: zod_1.z
        .string()
        .describe("The musical key for the style (e.g., C Major, A Minor)."),
    genre: zod_1.z.string().describe("The genre of the musical style."),
    instrumentation: zod_1.z
        .array(zod_1.z.string())
        .describe("List of instruments used in the musical style."),
    mood: zod_1.z.array(zod_1.z.string()).describe("Moods evoked by the musical style."),
    description: zod_1.z.string().describe("A brief description of the musical style."),
};
const StyleCard = zod_1.z.object({
    bpm: zod_1.z.number(),
    key: zod_1.z.string(),
    genre: zod_1.z.string(),
    instrumentation: zod_1.z.array(zod_1.z.string()),
    mood: zod_1.z.array(zod_1.z.string()),
    description: zod_1.z.string(),
});
server.registerTool("find-musical-style", {
    title: "Find Musical Style",
    description: "Find a musical style based on given routing directions by drawing cultural references from the location.",
    inputSchema: inputShape,
    outputSchema: outputShape,
}, async (args, extra) => {
    // narrow & validate at runtime
    const lines = Array.isArray(args?.lines) ? args.lines.map(String) : [];
    // Placeholder implementation - replace with actual logic to determine musical style
    const card = lines.length % 2 === 0
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
    // validate runtime
    const parsed = StyleCard.parse(card);
    // return the MCP response envelope expected by the SDK
    const responseEnvelope = {
        // content array: many SDKs accept text/image/file choices here
        content: [
            {
                type: "text",
                text: "Style card generated successfully.",
                _meta: { note: "style card attached as structuredContent" },
            },
        ],
        // structuredContent is optional but convenient for programmatic clients
        structuredContent: {
            mimeType: "application/vnd.stylecard+json",
            data: parsed,
        },
        // include helpful metadata too
        _meta: {
            styleCard: parsed,
        },
    };
    // cast as any to satisfy the SDK typing if needed
    return responseEnvelope;
});
// Set up Express and HTTP transport
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.post("/mcp", async (req, res) => {
    // In stateless mode, create a new transport for each request to prevent
    // request ID collisions. Different clients may use the same JSON-RPC request IDs,
    // which would cause responses to be routed to the wrong HTTP connections if
    // the transport state is shared.
    try {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on("close", () => {
            transport.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
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
const port = parseInt(process.env.PORT || "3000");
app
    .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
})
    .on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
});
