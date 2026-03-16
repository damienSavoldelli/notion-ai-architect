import type { GeneratedProject } from "../../domain/entities/generated-project";

export interface AiArchitectService {
  generateProjectFromIdea(idea: string): Promise<GeneratedProject>;
}
