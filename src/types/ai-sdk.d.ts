declare module "ai/sdk" {
  export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
  }

  export interface Model {
    id: string;
    name: string;
    maxTokens: number;
    temperature: number;
  }

  export interface GenerateTextOptions {
    model: Model;
    messages: Message[];
  }

  export interface GenerateTextResponse {
    text: string;
  }

  export function generateText(
    options: GenerateTextOptions
  ): Promise<GenerateTextResponse>;
}
