import type { TaskPriority } from "./task";

export interface ProductOverview {
  name: string;
  description: string;
  target_users: ReadonlyArray<string>;
}

export interface TechnicalArchitecture {
  frontend: string;
  backend: string;
  database: string;
  infrastructure: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  type?: "feature" | "bug" | "chore";
  labels?: ReadonlyArray<string>;
  acceptance_criteria?: ReadonlyArray<string>;
}

export interface RoadmapSprint {
  sprint: string;
  tasks: ReadonlyArray<string>;
}

export interface GeneratedProject {
  product_overview: ProductOverview;
  architecture: TechnicalArchitecture;
  tasks: ReadonlyArray<GeneratedTask>;
  roadmap: ReadonlyArray<RoadmapSprint>;
}
