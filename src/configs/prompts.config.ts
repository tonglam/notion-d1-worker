// Text Generation Prompts
export const SUMMARY_PROMPT = (content: string): string =>
  `You are an expert summarizer. Your task is to create concise, informative summaries that capture the key points of technical articles. Please provide a concise summary (maximum 3 sentences) of the following technical article. Highlight the key technologies, concepts, and takeaways. Do NOT include "Summary:" or any other prefix in your response, just provide the summary directly:\n\n${content}`;

export const TAGS_PROMPT = (content: string, maxKeywords: number): string =>
  `Extract ${maxKeywords} relevant keywords or keyphrases from the following content. Provide them as a comma-separated list. Focus on terms that would work well as tags or for SEO:\n\n${content}`;

export const READING_TIME_PROMPT = (content: string): string =>
  `Analyze the following technical content and estimate how many minutes it would take an average reader to read and comprehend it. Consider factors like technical complexity, code snippets, and diagrams. Return ONLY the number of minutes (e.g., "5" for 5 minutes). Do not include any other text or explanation:\n\n${content}`;

// Image Generation Prompts
export const IMAGE_NEGATIVE_PROMPT =
  "text, words, writing, watermark, signature, blurry, low quality, ugly, distorted, photorealistic, photograph, human faces, hands, cluttered, chaotic layout, overly complex, childish, cartoon-like, unprofessional, Chinese characters, Chinese text, Asian characters, characters, text overlay, letters, numbers, any text, Asian text";

export const IMAGE_STYLE_CONFIG = {
  sceneDescription:
    "in a clean, minimalist digital environment with subtle tech-related background elements",
  styleDefinition:
    "modern digital art style with clean lines and a professional look, suitable for technical articles",
  cameraLanguage:
    "frontal perspective with balanced composition, moderate depth of field focusing on the central concept",
  lightingSetup:
    "soft, even lighting with subtle highlights to emphasize important elements, cool blue accent lighting",
  atmosphereWords: "informative, innovative, precise, and engaging atmosphere",
  detailModifiers:
    "with subtle grid patterns, simplified icons or symbols related to the prompt, using a cohesive color palette of blues, teals, and neutral tones",
  technicalParameters:
    "high-resolution, sharp details, professional vector-like quality",
} as const;

export const IMAGE_PROMPT = (cleanPrompt: string): string => {
  const subjectDescription = `a professional technical illustration representing the concept of "${cleanPrompt}" WITHOUT ANY TEXT OR LABELS`;

  return `${subjectDescription} ${IMAGE_STYLE_CONFIG.sceneDescription}. 
  Style: ${IMAGE_STYLE_CONFIG.styleDefinition}. 
  Composition: ${IMAGE_STYLE_CONFIG.cameraLanguage}. 
  Lighting: ${IMAGE_STYLE_CONFIG.lightingSetup}. 
  Atmosphere: ${IMAGE_STYLE_CONFIG.atmosphereWords}. 
  Details: ${IMAGE_STYLE_CONFIG.detailModifiers}. 
  Quality: ${IMAGE_STYLE_CONFIG.technicalParameters}.
  
  The illustration should visually communicate the key concepts: ${cleanPrompt}
  
  IMPORTANT: DO NOT INCLUDE ANY TEXT, WORDS, LABELS, OR CHARACTERS IN THE IMAGE. The illustration should be entirely visual without any textual elements.`;
};
