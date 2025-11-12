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
  prompt?: string;
  composition_plan?: CompositionPlan;
  music_length_ms?: number;
  output_format?: "mp3_44100_128" | "mp3_44100_192" | "mp3_22050_32" | "mp3_22050_64" | "mp3_22050_128" | "pcm_44100_16" | "ulaw_8000_8";
  model_id?: "music_v1";
  force_instrumental?: boolean;
  store_for_inpainting?: boolean;
}

/**
 * Composition Plan Interface
 * Detailed guide for music generation with sections, styles, and song metadata
 */
export interface CompositionPlan {
  positive_global_styles: string[];
  negative_global_styles: string[];
  sections: CompositionSection[];
  song_metadata?: SongMetadata;
}

/**
 * Composition Section Interface
 * Individual section within a composition plan
 */
export interface CompositionSection {
  section_name: string;
  positive_local_styles: string[];
  negative_local_styles: string[];
  duration_ms: number;
  lines: string[];
}

/**
 * Song Metadata Interface
 * Metadata about the generated song
 */
export interface SongMetadata {
  title?: string;
  description?: string;
  genres?: string[];
  languages?: string[];
  is_explicit?: boolean;
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
    .optional()
    .describe("A simple text prompt to generate a song from (max 4100 characters). Cannot be used with composition_plan."),
  composition_plan: z
    .object({
      positive_global_styles: z
        .array(z.string())
        .describe("Styles that should be present in the entire song (use English)."),
      negative_global_styles: z
        .array(z.string())
        .describe("Styles that should NOT be present in the entire song (use English)."),
      sections: z
        .array(
          z.object({
            section_name: z.string().describe("Name of the song section (e.g., 'Verse 1', 'Chorus')."),
            positive_local_styles: z
              .array(z.string())
              .describe("Styles specific to this section (use English)."),
            negative_local_styles: z
              .array(z.string())
              .describe("Styles to avoid in this section (use English)."),
            duration_ms: z
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
      song_metadata: z
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
          is_explicit: z.boolean().optional().describe("Whether the song contains explicit content."),
        })
        .optional()
        .describe("Metadata about the generated song."),
    })
    .optional()
    .describe("A detailed composition plan to guide music generation. Cannot be used with prompt."),
  music_length_ms: z
    .number()
    .int()
    .min(3000)
    .max(300000)
    .optional()
    .describe("The length of the song in milliseconds (3000-300000). Used only with prompt. Optional - model chooses if not provided."),
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
    .describe("If true, guarantees instrumental generation (default: false). Can only be used with prompt."),
  store_for_inpainting: z
    .boolean()
    .optional()
    .describe("Whether to store the song for inpainting (enterprise only, default: false)."),
};

