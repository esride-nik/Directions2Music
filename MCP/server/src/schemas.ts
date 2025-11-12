import { z } from "zod";

/**
 * StyleCard Interface
 * Represents a musical style with all its characteristics
 */
export interface StyleCard {
  bpm: number;
  key: string;
  genre: string;
  instrumentation: string[];
  mood: string[];
  description: string;
}

/***********************
** Input Interfaces   **
************************/

/**
 * Input interface for find-musical-style and dummy-find-musical-style tools
 */
export interface FindStyleInput {
  directions: string[];
}

/**
 * Input interface for generate-music tool
 */
export interface GenerateMusicInput {
  prompt: string;
  music_length_ms?: number;
  output_format?: "mp3_44100_128" | "mp3_44100_192" | "mp3_22050_32" | "mp3_22050_64" | "mp3_22050_128" | "pcm_44100_16" | "ulaw_8000_8";
  model_id?: "music_v1";
  force_instrumental?: boolean;
  store_for_inpainting?: boolean;
}

/**
 * Zod schema definition for StyleCard
 * Used for validation and API documentation
 */
export const styleCardSchema = {
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

/***********************
** Input Schemas      **
************************/

/**
 * Input schema for find-musical-style and dummy-find-musical-style tools
 */
export const findStyleInputSchema = {
  directions: z.array(
    z.string().describe("An array of routing directions as strings.")
  ),
};

/**
 * Input schema for generate-music tool
 */
export const generateMusicInputSchema = {
  prompt: z
    .string()
    .max(4100)
    .describe("A simple text prompt to generate a song from (max 4100 characters). Cannot be used with composition_plan."),
  music_length_ms: z
    .number()
    .int()
    .min(3000)
    .max(300000)
    .optional()
    .describe("The length of the song in milliseconds (3000-300000). Optional - model will choose if not provided."),
  output_format: z
    .enum([
      "mp3_44100_128",
      "mp3_44100_192",
      "mp3_22050_32",
      "mp3_22050_64",
      "mp3_22050_128",
      "pcm_44100_16",
      "ulaw_8000_8",
    ])
    .optional()
    .describe("Output format (default: mp3_44100_128). Some formats require specific subscription tiers."),
  model_id: z
    .enum(["music_v1"])
    .optional()
    .describe("The model to use for generation (default: music_v1)."),
  force_instrumental: z
    .boolean()
    .optional()
    .describe("If true, guarantees instrumental generation (default: false)."),
  store_for_inpainting: z
    .boolean()
    .optional()
    .describe("Whether to store the song for inpainting (enterprise only, default: false)."),
};

