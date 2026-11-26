export type AIProviderName = "claude" | "gemini" | "meta";

export interface AIImageInput {
  mimeType: string; // image/png, image/jpeg, image/webp
  base64: string;
}

export interface JSONCompletionRequest {
  system: string;
  user: string;
  images?: AIImageInput[];
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
}

export interface TextCompletionRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface AIProvider {
  name: AIProviderName;
  model: string;
  completeJSON(req: JSONCompletionRequest): Promise<string>;
  completeText(req: TextCompletionRequest): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIUnavailableError";
  }
}
