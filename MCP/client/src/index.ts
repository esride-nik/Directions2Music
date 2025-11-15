import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StyleCard, FindStyleInput, ElevenLabsGenerateMusicInput, styleCardSchema, findStyleInputSchema, elevenLabsGenerateMusicInputSchema } from "../../server/src/schemas.js";

// Helper function to extract and validate StyleCard from tool result
function extractStyleCard(toolResult: any): StyleCard {
  if (toolResult?.structuredContent) {
    return toolResult.structuredContent as StyleCard;
  }
  throw new Error('No structuredContent in tool result');
}

const baseUrl = 'http://localhost:3000/mcp';
const client = new Client({
    name: 'streamable-http-client',
    version: '1.0.0'
});
const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
await client.connect(transport);
console.log('Connected using Streamable HTTP transport');

// List prompts
// const prompts = await client.listPrompts();

// // Get a prompt
// const prompt = await client.getPrompt({
//     name: 'example-prompt',
//     arguments: {
//         arg1: 'value'
//     }
// });

// // List resources
// const resources = await client.listResources();

// // Read a resource
// const resource = await client.readResource({
//     uri: 'file:///example.txt'
// });

/****************************************
// TODO: Replace with actual directions from web application
*****************************************/
const directionsInput = ["Start at SP414, 84069, Roccadaspide, Salernes","Go northwest on SP414","At the roundabout, take the second exit to stay on SP414 (Via di Ponente)","Turn left on SS166 (Via Santa Maria)","Continue forward on Via Serra (SS166)","Continue forward on SP11 (Via Serra)","Make a sharp right on SP419 (Via Vocitiello)","Make a sharp left on Frazione Canne","Continue forward on Via Doglie","Turn left to stay on Via Doglie","Bear right on Via Piano del Carpine","Continue forward on Via Palata","Continue forward on Via Santa Tecchia","Turn right to stay on Via Santa Tecchia","Bear left on Via Canale","Turn right, then turn left","Continue forward on Via Canale","Continue forward on Via San Nicola","Bear right on Via Fontana di Jacopo (SP11)","Make a sharp right on SP88","Turn left on Località Genzano","Continue forward on Località Rimati","Continue forward on Località Campoluongo","Continue forward on SP317 (Località Campoluongo)","Keep left at the fork onto SP317 (Località Scanno)","Turn left at Località Scanno to stay on SP317 (Località Scanno)","At the roundabout, take the second exit onto SP317","At the roundabout, take the first exit onto SP30 (Via Provinciale del Cornito)","At the roundabout, take the second exit onto SP30 (Via Provinciale del Cornito)","Turn left to merge onto the highway toward Salerno / Reggio di Calabria","Keep left at the fork to stay on E45 toward A3 / NAPOLI / SALERNO","Go forward on Autostrada del Mediterraneo Diramazione Napoli (A2dir)","Go forward on A3 toward NAPOLI","Take the exit on the right to merge onto the highway toward NAPOLI","Take the exit on the right to merge onto the highway toward centro / imbarco aliscafi / PORTO / imbarco traghetti","Take the exit to merge onto Via Ponte dei Granili","Continue forward on Via Reggia di Portici","At the roundabout, take the second exit onto Via Alessandro Volta","At the roundabout, take the second exit onto Via Amerigo Vespucci","At the traffic light, continue forward on Via Nuova Marina (Via Marina)","Make a U-turn at Via Cristoforo Colombo / Via Alcide De Gasperi and go back on Via Nuova Marina (Via Marina)","Turn right on Calata Porta di Massa","At the roundabout, take the first exit to stay on Calata Porta di Massa","At the roundabout, take the third exit","Continue forward on Calata Piliero","Continue forward on Molo Angioino","At the roundabout, take the second exit to stay on Molo Angioino","Turn left to stay on Molo Angioino","Finish at Totem Della Pace, on the right"];


/****************************************
* Find musical style based on directions
*****************************************/
const musicalStyleResult = await client.callTool({
    name: 'find-musical-style',
    arguments: {
        directions: directionsInput,
        dummyMode: true
    }
});
// Extract the StyleCard from the result
const styleCard: StyleCard = extractStyleCard(musicalStyleResult);
console.log('Musical Style Result:', JSON.stringify(styleCard));


/*************************************************
// Use the StyleCard and lyrics to generate music
**************************************************/
const musicGenerationResult = await client.callTool({
    name: 'generate-music',
    arguments: {
        styleCard: styleCard,
        lyrics: directionsInput,
        dummyMode: true
    }
});
console.log('Music Generation Result:', JSON.stringify(musicGenerationResult, null, 2));

await client.close();