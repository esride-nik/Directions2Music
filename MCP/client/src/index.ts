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
    // name: 'find-musical-style',
    name: 'dummy-find-musical-style',
    arguments: {
        // directions: ["Start at 30052, Hassi Ben Abdellah, Sidi Khouiled, Ouargla","Go west toward RN56","Restriction: Avoid Unpaved Roads","Turn right on RN56","Turn left to RN56","Turn left to stay on RN56","At the roundabout, take the third exit onto RN49","At the roundabout, take the first exit to stay on RN49","Continue forward on RN3","At the roundabout, take the third exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the third exit onto RN3","At the roundabout, take the third exit to stay on RN3","Turn right","Make a sharp left","Arrive at 30001, Hassi Messaoud, Ouargla, on the right","Depart 30001, Hassi Messaoud, Ouargla","Go back north","At the roundabout, take the fifth exit onto RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the first exit to stay on RN3","At the roundabout, take the second exit to stay on RN3","At the roundabout, take the second exit to stay on RN49","At the roundabout, take the second exit to stay on RN49","At the roundabout, take the first exit","At the roundabout, take the second exit","At the roundabout, take the second exit","At the roundabout, take the second exit","Turn right on CW202","Bear right","Keep left at the fork","Bear right on CW202","Turn right","Restriction: Avoid Unpaved Roads","Turn right, then turn left","Finish at 30031, N'goussa, Ouargla, on the right"]
        directions: ["Start at SP414, 84069, Roccadaspide, Salernes","Go northwest on SP414","At the roundabout, take the second exit to stay on SP414 (Via di Ponente)","Turn left on SS166 (Via Santa Maria)","Continue forward on Via Serra (SS166)","Continue forward on SP11 (Via Serra)","Make a sharp right on SP419 (Via Vocitiello)","Make a sharp left on Frazione Canne","Continue forward on Via Doglie","Turn left to stay on Via Doglie","Bear right on Via Piano del Carpine","Continue forward on Via Palata","Continue forward on Via Santa Tecchia","Turn right to stay on Via Santa Tecchia","Bear left on Via Canale","Turn right, then turn left","Continue forward on Via Canale","Continue forward on Via San Nicola","Bear right on Via Fontana di Jacopo (SP11)","Make a sharp right on SP88","Turn left on Località Genzano","Continue forward on Località Rimati","Continue forward on Località Campoluongo","Continue forward on SP317 (Località Campoluongo)","Keep left at the fork onto SP317 (Località Scanno)","Turn left at Località Scanno to stay on SP317 (Località Scanno)","At the roundabout, take the second exit onto SP317","At the roundabout, take the first exit onto SP30 (Via Provinciale del Cornito)","At the roundabout, take the second exit onto SP30 (Via Provinciale del Cornito)","Turn left to merge onto the highway toward Salerno / Reggio di Calabria","Keep left at the fork to stay on E45 toward A3 / NAPOLI / SALERNO","Go forward on Autostrada del Mediterraneo Diramazione Napoli (A2dir)","Go forward on A3 toward NAPOLI","Take the exit on the right to merge onto the highway toward NAPOLI","Take the exit on the right to merge onto the highway toward centro / imbarco aliscafi / PORTO / imbarco traghetti","Take the exit to merge onto Via Ponte dei Granili","Continue forward on Via Reggia di Portici","At the roundabout, take the second exit onto Via Alessandro Volta","At the roundabout, take the second exit onto Via Amerigo Vespucci","At the traffic light, continue forward on Via Nuova Marina (Via Marina)","Make a U-turn at Via Cristoforo Colombo / Via Alcide De Gasperi and go back on Via Nuova Marina (Via Marina)","Turn right on Calata Porta di Massa","At the roundabout, take the first exit to stay on Calata Porta di Massa","At the roundabout, take the third exit","Continue forward on Calata Piliero","Continue forward on Molo Angioino","At the roundabout, take the second exit to stay on Molo Angioino","Turn left to stay on Molo Angioino","Finish at Totem Della Pace, on the right"]
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