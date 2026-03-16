import { z } from "zod";

const envSchema = z.object({
  NOTION_API_TOKEN: z.string().min(1),
  NOTION_IDEAS_DATABASE_ID: z.string().min(1),
  NOTION_PROJECTS_DATABASE_ID: z.string().min(1),
  NOTION_TASKS_DATABASE_ID: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_OWNER: z.string().min(1),
  GITHUB_REPO: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema>;

export const loadEnv = (source: Record<string, string | undefined>): AppEnv =>
  envSchema.parse(source);
