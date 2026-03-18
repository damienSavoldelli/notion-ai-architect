import { z } from "zod";
import type { GeneratedProject } from "../../domain/entities/generated-project";

const stringArrayField = z.preprocess((value) => {
  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items;
  }
  return value;
}, z.array(z.string().min(1)));

export const generatedProjectSchema = z.object({
  product_overview: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    target_users: stringArrayField,
    core_features: z.array(z.string().min(1)).optional(),
  }),
  architecture: z.object({
    frontend: z.string().min(1),
    backend: z.string().min(1),
    database: z.string().min(1),
    infrastructure: z.string().min(1),
    external_services: z.array(z.string().min(1)).optional(),
  }),
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(["low", "medium", "high"]),
      type: z.enum(["feature", "bug", "chore"]).optional(),
      labels: z.array(z.string().min(1)).optional(),
      acceptance_criteria: z.array(z.string().min(1)).optional(),
      technical_notes: z.string().min(1).optional(),
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
