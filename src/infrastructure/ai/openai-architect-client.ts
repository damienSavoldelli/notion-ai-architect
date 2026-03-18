import OpenAI from "openai";
import type { AiArchitectService } from "../../application/ports/ai-architect-service";
import type { GeneratedProject } from "../../domain/entities/generated-project";
import { safeParseGeneratedProject } from "./generated-project-schema";

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
  private static readonly MAX_ATTEMPTS = 2;

  constructor(
    private readonly config: OpenAiArchitectClientConfig,
    openaiSdk?: OpenAiSdk,
  ) {
    this.openai = openaiSdk ?? new OpenAI({ apiKey: config.apiKey });
  }

  async generateProjectFromIdea(idea: string): Promise<GeneratedProject> {
    const sanitizedIdea = sanitizeIdeaInput(idea);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= OpenAiArchitectClient.MAX_ATTEMPTS; attempt += 1) {
      const response = await this.openai.responses.create({
        model: this.config.model,
        input: buildPrompt(sanitizedIdea, attempt),
      });

      const outputText = extractOutputText(response);
      if (!outputText) {
        lastError = new Error(
          "OpenAI response did not include any text output after retries.",
        );
        continue;
      }

      const parsedJson = safeJsonParse(outputText);
      if (!parsedJson.ok) {
        lastError = new Error("OpenAI response is not valid JSON after retries.");
        continue;
      }

      const validated = safeParseGeneratedProject(parsedJson.value);
      if (!validated.success) {
        lastError = new Error(
          "OpenAI response JSON does not match expected schema after retries.",
        );
        continue;
      }

      return validated.data;
    }

    throw lastError ?? new Error("OpenAI response validation failed.");
  }
}

const buildPrompt = (idea: string, attempt: number): string =>
  `${SYSTEM_PROMPT}

${attempt > 1 ? "Previous response was invalid. Return valid JSON only.\n" : ""}

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

const safeJsonParse = (
  value: string,
): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
};

const sanitizeIdeaInput = (idea: string): string => {
  const withoutControlChars = idea.replace(
    /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g,
    " ",
  );
  const trimmed = withoutControlChars.replace(/\s+/g, " ").trim();
  const maxLength = 1200;
  const limited = trimmed.slice(0, maxLength);

  return limited.length > 0 ? limited : "Untitled project idea";
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
