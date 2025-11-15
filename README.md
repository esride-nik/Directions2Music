# Directions2Music

Convert routing directions into musical compositions using AI-powered style detection and music generation.

## Overview

This project transforms GPS routing directions into personalized music by:
1. **Analyzing directions** to infer musical style based on cultural and geographical context
2. **Generating music** using ElevenLabs AI that matches the journey's character
3. **Serving audio files** via a web-friendly API for playback

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebClient     │    │  Client Express │    │   MCP Server    │
│  (Frontend)     │◄──►│   (Port 3001)   │◄──►│  (Port 3000)    │
│                 │    │                 │    │                 │
│ • User Input    │    │ • Orchestration │    │ • AI Processing │
│ • Audio Playback│    │ • File Serving  │    │ • Music Gen     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Test

To test the complete system:

```bash
# Make the test script executable
chmod +x test_client_server.sh

# Run the automated test
./test_client_server.sh
```

This will start both servers, send sample directions, generate music, and return an audio file URL.

## Prerequisites

### 1. API Keys Setup

The system requires API keys for:
- **Google Gemini AI** (for style detection)
- **ElevenLabs** (for music generation)

#### Configure API Keys:

```bash
# Navigate to MCP server directory
cd MCP/server

# Copy the template configuration
cp config.json.template config.json

# Edit config.json with your API keys
{
  "googleGenAIApiKey": "YOUR_GOOGLE_GENAI_API_KEY_HERE",
  "elevenLabsApiKey": "YOUR_ELEVENLABS_API_KEY_HERE"
}
```

> **Security Note**: `config.json` is gitignored to protect your API keys. Never commit API keys to version control.

#### Obtaining API Keys:

- **Google Gemini**: Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **ElevenLabs**: Get your API key from [ElevenLabs Dashboard](https://elevenlabs.io/app/speech-synthesis) → Profile → API Key

### 2. Dependencies

Install Node.js dependencies for both servers:

```bash
# Install MCP server dependencies
cd MCP/server
npm install

# Install Client server dependencies
cd ../client
npm install
```

### 3. Running the System

The system consists of two Node.js servers that work together:

#### Start MCP Server (Port 3000)
```bash
cd MCP/server
npm start
```

The MCP server handles:
- AI-powered musical style detection
- Music generation via ElevenLabs API
- Audio file creation and storage

#### Start Client Express Server (Port 3001)
```bash
cd MCP/client
npm start
```

The Client server provides:
- `/orchestrate` endpoint for complete workflow
- Static file serving for generated MP3s
- WebClient-friendly API responses

## API Usage

### Generate Music from Directions

```bash
curl -X POST "http://localhost:3001/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{
    "directions": [
      "Start at Times Square, New York",
      "Head south on Broadway",
      "Turn left on Houston Street",
      "Continue to your destination"
    ],
    "dummyMode": false
  }'
```

### Response Format

```json
{
  "success": true,
  "styleCard": {
    "genre": "jazz",
    "songTitle": "Broadway Nights",
    "instrumentation": ["piano", "saxophone"],
    "mood": ["urban", "energetic"]
  },
  "audioUrl": "/audio/music_Broadway_Nights_2025-11-15T00-15-30-123Z.mp3",
  "audioFile": "music_Broadway_Nights_2025-11-15T00-15-30-123Z.mp3",
  "message": "Successfully generated jazz music: \"Broadway Nights\""
}
```

## Testing & Development

### Automated Test Script

The `test_client_server.sh` script provides automated testing:

```bash
./test_client_server.sh
```

**What it does:**
1. Starts both servers in the background
2. Waits for startup completion
3. Tests health endpoint
4. Sends sample directions for orchestration
5. Displays results and audio file information
6. Cleans up background processes

### Manual Testing Endpoints

#### Health Check
```bash
curl -X GET "http://localhost:3001/health"
```

#### List Generated Audio Files
```bash
curl -X GET "http://localhost:3001/audio-files"
```

#### Sample Request Format
```bash
curl -X GET "http://localhost:3001/test"
```

### Dummy Mode

For testing without API usage/costs:
```json
{
  "directions": ["Sample directions..."],
  "dummyMode": true
}
```

Dummy mode uses pre-recorded responses for both style detection and music generation.

## WebClient Integration

To integrate with a web frontend:

```html
<audio controls>
  <source id="audioSource" src="" type="audio/mpeg">
</audio>

<script>
async function generateMusic(directions) {
  const response = await fetch('http://localhost:3001/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directions, dummyMode: false })
  });
  
  const result = await response.json();
  if (result.success && result.audioUrl) {
    document.getElementById('audioSource').src = 
      `http://localhost:3001${result.audioUrl}`;
    document.querySelector('audio').load();
    document.querySelector('audio').play();
  }
}
</script>
```

## File Structure

```
Directions2Music/
├── README.md                          # This file
├── test_client_server.sh              # Automated test script
├── MCP/
│   ├── server/                        # MCP Server (AI Processing)
│   │   ├── README.md                  # Server-specific documentation
│   │   ├── config.json.template       # API key template
│   │   ├── config.json                # Your API keys (gitignored)
│   │   ├── src/
│   │   │   ├── index.ts              # Main server logic
│   │   │   └── schemas.ts            # Data validation schemas
│   │   └── dummyData/                # Test data
│   └── client/                       # Client Express Server (API Layer)
│       ├── src/
│       │   └── index.ts              # Express server & orchestration
│       └── package.json
└── WebClient/                        # Frontend (your implementation)
```

## Troubleshooting

### Common Issues

**"Could not read config file"**
- Ensure `config.json` exists in `MCP/server/`
- Check that API keys are properly formatted (no extra quotes/spaces)

**"Failed to connect to localhost"**
- Verify both servers are running (`npm start` in each directory)
- Check ports 3000 and 3001 are not blocked by firewall

**"API key invalid"**
- Verify API keys are active and have sufficient credits
- Check API key format matches the service requirements

**"No audio file found"**
- Check MCP server logs for file creation messages
- Verify dummy data files exist in `MCP/server/dummyData/`

### Debug Mode

Enable detailed logging by checking server console output:
- MCP Server: Shows composition plans and file operations
- Client Server: Shows orchestration steps and file discovery

## Development

### Adding New Features

1. **Server Logic**: Modify `MCP/server/src/index.ts`
2. **API Schemas**: Update `MCP/server/src/schemas.ts`  
3. **Client API**: Extend `MCP/client/src/index.ts`
4. **Testing**: Update `test_client_server.sh`

### Production Deployment

For production use:
1. Set up proper environment variable management
2. Configure HTTPS and CORS policies
3. Implement rate limiting and authentication
4. Set up audio file cleanup/archiving
5. Monitor API usage and costs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes with `./test_client_server.sh`
4. Submit a pull request

## License

[Add your license here]