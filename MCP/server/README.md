# Directions2Music MCP Server

This is a Model Context Protocol (MCP) server for the Directions2Music project. It provides tools for finding musical styles based on routing directions and generating music using AI models.

- [Directions2Music MCP Server](#directions2music-mcp-server)
  - [Tools](#tools)
    - [1. find-musical-style](#1-find-musical-style)
    - [2. dummy-find-musical-style](#2-dummy-find-musical-style)
    - [3. generate-music](#3-generate-music)
  - [API Reference](#api-reference)
  - [Getting Started](#getting-started)
    - [Installation](#installation)
    - [Running the Server](#running-the-server)
  - [Environment Variables](#environment-variables)
  - [File Structure](#file-structure)
  - [Notes](#notes)
  - [Comparison of Music GenAIs](#comparison-of-music-genais)



## Tools

### 1. find-musical-style

Find a musical style based on given routing directions by drawing cultural references from the location.

**Input:**
- `directions` (array of strings): An array of routing directions as strings

**Output:**
- A StyleCard object containing:
  - `bpm`: Beats per minute for the musical style
  - `key`: The musical key (e.g., C Major, A Minor)
  - `genre`: The genre of the musical style
  - `instrumentation`: Array of instruments used in the musical style
  - `mood`: Array of moods evoked by the musical style
  - `description`: A brief description of the musical style

**Implementation:** Uses Google Gemini LLM to analyze directions and infer musical style from cultural references.

---

### 2. dummy-find-musical-style

A non-LLM version of find-musical-style that returns deterministic results from local dummy data for testing and development.

**Input:**
- `directions` (array of strings): An array of routing directions as strings

**Output:**
- A StyleCard object (same structure as find-musical-style)

**Implementation:** Reads from a local JSON file (`../dummyData/dummyResponses_musicalStyle.json`) and returns a random entry from the dummy responses.

---

### 3. generate-music

Generate music based on the provided prompt and style parameters using the ElevenLabs Music API.

**Description:**
Generate music based on the provided routing directions and style card using the ElevenLabs Music API.

**Input Parameters:**

| Parameter | Type | Required | Range | Description |
|-----------|------|----------|-------|-------------|
| **prompt** | string | ✅ Yes | Max 4,100 characters | A simple text prompt to generate a song from. Cannot be used in conjunction with `composition_plan`. |
| **music_length_ms** | integer | ❌ Optional | 3,000–300,000 ms | The length of the song to generate in milliseconds. Optional - if not provided, the model will choose a length based on the prompt. |
| **output_format** | enum | ❌ Optional | See below | Output format of the generated audio. Formatted as codec_sample_rate_bitrate. Some formats require specific subscription tiers. Defaults to `mp3_44100_128`. |
| **model_id** | enum | ❌ Optional | `music_v1` | The model to use for generation. Currently only `music_v1` is available. Defaults to `music_v1`. |
| **force_instrumental** | boolean | ❌ Optional | `true` or `false` | If true, guarantees that the generated song will be instrumental. If false, the song may or may not be instrumental depending on the prompt. Defaults to `false`. |
| **store_for_inpainting** | boolean | ❌ Optional | `true` or `false` | Whether to store the generated song for inpainting. Only available to enterprise clients with access to the inpainting API. Defaults to `false`. |

**Supported Output Formats:**

The `output_format` parameter accepts the following values:

- `mp3_44100_128` — MP3, 44.1 kHz, 128 kbps (default)
- `mp3_44100_192` — MP3, 44.1 kHz, 192 kbps (requires Creator tier or above)
- `mp3_22050_32` — MP3, 22.05 kHz, 32 kbps
- `mp3_22050_64` — MP3, 22.05 kHz, 64 kbps
- `mp3_22050_128` — MP3, 22.05 kHz, 128 kbps
- `pcm_44100_16` — PCM, 44.1 kHz, 16-bit (requires Pro tier or above)
- `ulaw_8000_8` — μ-law (mu-law), 8 kHz, 8-bit (commonly used for Twilio audio inputs)

**Output:**
- A StyleCard object containing metadata about the generated music

**Implementation:**
Currently a placeholder that logs the parameters. Will be updated to call the ElevenLabs API endpoint: `POST https://api.elevenlabs.io/v1/music/detailed`

**Example Usage:**

```json
{
  "prompt": "Upbeat pop song with disco influences about New York City at night",
  "music_length_ms": 30000,
  "output_format": "mp3_44100_128",
  "force_instrumental": false
}
```

---

## API Reference

All tools are exposed via HTTP POST to the `/mcp` endpoint on the server.

**Request Format:** JSON-RPC 2.0

**Response Format:** Multipart response with JSON metadata and binary audio data (for generate-music)

---

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up configuration:
```bash
# Copy the template to create your config file
cp config.json.template config.json
```

3. Edit `config.json` and add your API keys:
```json
{
  "googleGenAIApiKey": "YOUR_GOOGLE_GENAI_API_KEY_HERE",
  "elevenLabsApiKey": "YOUR_ELEVENLABS_API_KEY_HERE"
}
```

**Important:** The `config.json` file is gitignored to keep your API keys secure.

### Running the Server

```bash
npm start
```

The server will start on the port specified by the `PORT` environment variable (defaults to 3000).

```bash
PORT=8080 npm start
```

For Windows compatibility with cross-platform commands:

```bash
npm start  # Uses cross-env to set PORT=8080
```

---

## Environment Variables

- `PORT`: The port on which the server listens (default: 3000)

## Configuration

API keys are loaded from `config.json` (see `config.json.template` for the format):
- `googleGenAIApiKey`: API key for Google Gemini LLM 
- `elevenLabsApiKey`: API key for music generation with ElevenLabs

---

## File Structure

```
server/
├── src/
│   └── index.ts              # Main MCP server implementation
├── dummyData/
│   └── dummyResponses_musicalStyle.json  # Dummy responses for testing
├── package.json
└── README.md
```

---

## Notes

- The `find-musical-style` tool requires a valid Google Gemini API key to function.
- The `dummy-find-musical-style` tool is useful for testing without LLM calls.
- The `generate-music` tool is currently a placeholder and requires implementation of the ElevenLabs API integration.


---

## Comparison of Music GenAIs

* Google Gemini / Lyria: Targeted on on-the-fly music alteration für background music. Not able to create a full song with exact lyrics.
  * API not tested
* ElevenLabs: Creates full songs. Vocals often not very understandable. Music quality and originality significantly lower than what Suno does.
  * API delivers binary MP3. Response not documented => bummer! [API doc](https://elevenlabs.io/docs/api-reference/music/compose-detailed) just says response is ``Multipart/mixed response with JSON metadata and binary audio file``, but no word about the JSON structure. Hard to find out in such a long response.
  * wrapped in npm package, which is quite comfy
  * not all requests well documented
  * API limited to 40 lines of lyrics, a maximum text length, only 2 mins of music per song... discovered all those API limitations after buying the plan for a month and was pretty disappointed
* Suno: best overall
  * no API :(
  * [API project on Github](https://github.com/gcui-art/suno-api) needs extras, like ReCaptcha + of course the paid Suno account, when exceeding the free tier limit
  * still the best free tier out there
* This page called [Sunoapi](https://sunoapi.org/api-key) says that it wraps "your models" => which models? 
  * Quality tested at [the playground](https://sunoapi.org/playground) didn't seem so great. Is this really Suno? Bad luck?
* [Mureka](https://www.mureka.ai/) seemed fine - maybe not as shiny as Suno, but the minimum amount to buy credits is 30$.. too expensive.