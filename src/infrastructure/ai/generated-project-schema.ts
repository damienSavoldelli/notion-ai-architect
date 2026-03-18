import { z } from "zod";
import type { GeneratedProject } from "../../domain/entities/generated-project";

export const generatedProjectSchema = z.object({
  product_overview: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    target_users: z.array(z.string().min(1)),
  }),
  architecture: z.object({
    frontend: z.string().min(1),
    backend: z.string().min(1),
    database: z.string().min(1),
    infrastructure: z.string().min(1),
  }),
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(["low", "medium", "high"]),
      type: z.enum(["feature", "bug", "chore"]).optional(),
      labels: z.array(z.string().min(1)).optional(),
      acceptance_criteria: z.array(z.string().min(1)).optional(),
    }),
  ),
  roadmap: z.array(
    z.object({
      sprint: z.string().min(1),
      tasks: z.array(z.string().min(1)),
    }),
  ),
});

export const parseGeneratedProject = (value: unknown): GeneratedProject =>
  generatedProjectSchema.parse(value);

export const safeParseGeneratedProject = (
  value: unknown,
): ReturnType<typeof generatedProjectSchema.safeParse> =>
  generatedProjectSchema.safeParse(value);
