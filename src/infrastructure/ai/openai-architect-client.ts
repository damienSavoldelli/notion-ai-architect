import OpenAI from "openai";
import type { AiArchitectService } from "../../application/ports/ai-architect-service";
import type { GeneratedProject } from "../../domain/entities/generated-project";
import { parseGeneratedProject } from "./generated-project-schema";

const SYSTEM_PROMPT = `You are a senior software architect and AI engineer.

Transform the following project idea into a structured JSON object.

Return only valid JSON.

Schema:

{
 "product_overview": {},
 "architecture": {},
 "tasks": [],
 "roadmap": []
}`;

interface OpenAiResponsesApi {
  create(params: {
    model: string;
    input: string;
    temperature?: number;
  }): Promise<unknown>;
}

interface OpenAiSdk {
  responses: OpenAiResponsesApi;
}

export interface OpenAiArchitectClientConfig {
  apiKey: string;
  model: string;
}

export class OpenAiArchitectClient implements AiArchitectService {
  private readonly openai: OpenAiSdk;

  constructor(
    private readonly config: OpenAiArchitectClientConfig,
    openaiSdk?: OpenAiSdk,
  ) {
    this.openai = openaiSdk ?? new OpenAI({ apiKey: config.apiKey });
  }

  async generateProjectFromIdea(idea: string): Promise<GeneratedProject> {
    const response = await this.openai.responses.create({
      model: this.config.model,
      input: buildPrompt(idea),
      temperature: 0.2,
    });

    const outputText = extractOutputText(response);
    if (!outputText) {
      throw new Error("OpenAI response did not include any text output.");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch {
      throw new Error("OpenAI response is not valid JSON.");
    }

    return parseGeneratedProject(parsedJson);
  }
}

const buildPrompt = (idea: string): string =>
  `${SYSTEM_PROMPT}

Project idea:

${idea}`;

const extractOutputText = (response: unknown): string | null => {
  if (!isObject(response)) {
    return null;
  }

  const directText = response.output_text;
  if (typeof directText === "string" && directText.trim()) {
    return directText.trim();
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return null;
  }

  const textParts: string[] = [];
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!isObject(content)) {
        continue;
      }

      if (content.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  const merged = textParts.join("").trim();
  return merged || null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
