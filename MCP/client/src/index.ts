import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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

// Call a tool
const result = await client.callTool({
    name: 'find-musical-style',
    arguments: {
        directions: "Start at 30052, Hassi Ben Abdellah, Sidi Khouiled, Ouargla"
        // directions: ["Start at 30052, Hassi Ben Abdellah, Sidi Khouiled, Ouargla","Go west toward RN56","Restriction: Avoid Unpaved Roads","Turn right on RN56","Turn left to RN56","Turn left to stay on RN56","At the roundabout, take the third exit onto RN49","At the roundabout, take the first exit to stay on RN49","Continue forward on RN3","At the roundabout, take the third exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the third exit onto RN3","At the roundabout, take the third exit to stay on RN3","Turn right","Make a sharp left","Arrive at 30001, Hassi Messaoud, Ouargla, on the right","Depart 30001, Hassi Messaoud, Ouargla","Go back north","At the roundabout, take the fifth exit onto RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the first exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN49","At the roundabout, take the second exit to stay on RN49","At the roundabout, take the first exit","At the roundabout, take the second exit","At the roundabout, take the second exit","At the roundabout, take the second exit","Turn right on CW202","Bear right","Keep left at the fork","Bear right on CW202","Turn right","Restriction: Avoid Unpaved Roads","Turn right, then turn left","Finish at 30031, N'goussa, Ouargla, on the right"]
    }
});

// const result = await client.callTool({
//     name: 'calculate-bmi',
//     arguments: {
//             weightKg: 80,
//             heightM: 181
//         }
// });

// console.log('Prompts:', prompts);
// console.log('Prompt:', prompt);
// console.log('Resources:', resources);
// console.log('Resource:', resource);
console.log('Tool Result:', JSON.stringify(result, null, 2));
await client.close();