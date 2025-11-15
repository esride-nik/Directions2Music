import { compositionPlan } from "@elevenlabs/elevenlabs-js/api/resources/music/index.js";
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
  songTitle: string;
}

/***********************
** Input Interfaces   **
************************/

/**
 * Input interface for find-musical-style and dummy-find-musical-style tools
 */
export interface FindStyleInput {
  directions: string[];
  dummyMode?: boolean;
}

/**
 * Input interface for generate-music tool
 */
export interface GenerateMusicInput {
  styleCard: StyleCard;
  lyrics: string[];
  dummyMode?: boolean;
}

/**
 * Input interface for generate-music tool
 */
export interface ElevenLabsGenerateMusicInput {
  prompt?: string;
  compositionPlan?: ElevenLabsCompositionPlan;
  musicLengthMs?: number;
  outputFormat?: "mp3_44100_128" | "mp3_44100_192" | "mp3_22050_32" | "mp3_22050_64" | "mp3_22050_128" | "pcm_44100_16" | "ulaw_8000_8";
  modelId?: "music_v1";
  forceInstrumental?: boolean;
  storeForInpainting?: boolean;
}

/**
 * Composition Plan Interface
 * Detailed guide for music generation with sections, styles, and song metadata
 */
export interface ElevenLabsCompositionPlan {
  positiveGlobalStyles: string[];
  negativeGlobalStyles: string[];
  sections: ElevenLabsCompositionSection[];
  songMetadata?: ElevenLabsSongMetadata;
}

/**
 * Composition Section Interface
 * Individual section within a composition plan
 */
export interface ElevenLabsCompositionSection {
  sectionName: string;
  positiveLocalStyles: string[];
  negativeLocalStyles: string[];
  durationMs: number;
  lines: string[];
}

/**
 * Song Metadata Interface
 * Metadata about the generated song
 */
export interface ElevenLabsSongMetadata {
  title?: string;
  description?: string;
  genres?: string[];
  languages?: string[];
  isExplicit?: boolean;
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
  songTitle: z.string().describe("The song title."),
}

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
  dummyMode: z.boolean().optional().describe("If true, activates dummy mode for testing."),
}

/** * Input schema for generate-music tool
 */
export const generateMusicInputSchema = {
  styleCard: z.object(styleCardSchema),
  lyrics: z.array(z.string()).describe("An array of lyrics lines as strings."),
  dummyMode: z.boolean().optional().describe("If true, activates dummy mode for testing."),
}

/**
 * Input schema for ElevanLabs generate-music tool
 */
export const elevenLabsGenerateMusicInputSchema = {
  prompt: z
    .string()
    .max(4100)
    .optional()
    .describe("A simple text prompt to generate a song from (max 4100 characters). Cannot be used with composition_plan."),
  compositionPlan: z
    .object({
      positiveGlobalStyles: z
        .array(z.string())
        .describe("Styles that should be present in the entire song (use English)."),
      negativeGlobalStyles: z
        .array(z.string())
        .describe("Styles that should NOT be present in the entire song (use English)."),
      sections: z
        .array(
          z.object({
            sectionName: z.string().describe("Name of the song section (e.g., 'Verse 1', 'Chorus')."),
            positiveLocalStyles: z
              .array(z.string())
              .describe("Styles specific to this section (use English)."),
            negativeLocalStyles: z
              .array(z.string())
              .describe("Styles to avoid in this section (use English)."),
            durationMs: z
              .number()
              .int()
              .min(1000)
              .describe("Duration of this section in milliseconds."),
            lines: z
              .array(z.string())
              .describe("Lyrics or content lines for this section."),
          })
        )
        .describe("Array of sections that make up the composition."),
      songMetadata: z
        .object({
          title: z.string().optional().describe("Title of the song."),
          description: z.string().optional().describe("Description of the song."),
          genres: z
            .array(z.string())
            .optional()
            .describe("Array of genres."),
          languages: z
            .array(z.string())
            .optional()
            .describe("Array of language codes (e.g., 'en', 'fr')."),
          isExplicit: z.boolean().optional().describe("Whether the song contains explicit content."),
        })
        .optional()
        .describe("Metadata about the generated song."),
    })
    .optional()
    .describe("A detailed composition plan to guide music generation. Cannot be used with prompt."),
  musicLengthMs: z
    .number()
    .int()
    .min(3000)
    .max(300000)
    .optional()
    .describe("The length of the song in milliseconds (3000-300000). Used only with prompt. Optional - model chooses if not provided."),
  outputFormat: z
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
  modelId: z
    .enum(["music_v1"])
    .optional()
    .describe("The model to use for generation (default: music_v1)."),
  forceInstrumental: z
    .boolean()
    .optional()
    .describe("If true, guarantees instrumental generation (default: false). Can only be used with prompt.")
};

/*************************
** Output Schemas       **
**************************/

/**
 * Output schema for generate-music tool - represents ElevenLabs music generation response
 */
export const generateMusicOutputSchema = {
  json: z.object({
    compositionPlan: z.object({
      positiveGlobalStyles: z.array(z.string()).describe("Global styles applied to the entire song"),
      negativeGlobalStyles: z.array(z.string()).describe("Styles to avoid in the entire song"),
      sections: z.array(z.object({
        sectionName: z.string().describe("Name of this section of the song"),
        positiveLocalStyles: z.array(z.string()).describe("Styles for this specific section"),
        negativeLocalStyles: z.array(z.string()).describe("Styles to avoid in this section"),
        durationMs: z.number().describe("Duration of this section in milliseconds"),
        lines: z.array(z.string()).describe("Lyric lines for this section")
      })).describe("Sections that make up the song")
    }).describe("The composition plan used to generate the music"),
    songMetadata: z.object({
      title: z.string().nullable().describe("Generated song title"),
      description: z.string().nullable().describe("Generated song description"),
      genres: z.array(z.string()).describe("Detected or assigned genres"),
      languages: z.array(z.string()).describe("Languages detected in the song"),
      isExplicit: z.boolean().nullable().describe("Whether the song contains explicit content")
    }).describe("Metadata about the generated song")
  }).describe("JSON metadata about the generated music"),
  audio: z.object({
    type: z.literal("Buffer").describe("Type indicator for serialized audio data"),
    data: z.array(z.number()).describe("Raw audio bytes as array of numbers")
  }).describe("Audio data in serialized Buffer format"),
  filename: z.string().describe("Suggested filename for the audio file")
};

/**********************
** Type Definitions  **
***********************/

export type GenerateMusicOutput = {
  json: {
    compositionPlan: {
      positiveGlobalStyles: string[];
      negativeGlobalStyles: string[];
      sections: Array<{
        sectionName: string;
        positiveLocalStyles: string[];
        negativeLocalStyles: string[];
        durationMs: number;
        lines: string[];
      }>;
    };
    songMetadata: {
      title: string | null;
      description: string | null;
      genres: string[];
      languages: string[];
      isExplicit: boolean | null;
    };
  };
  audio: {
    type: "Buffer";
    data: number[];
  };
  filename: string;
};
