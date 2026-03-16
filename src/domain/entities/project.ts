export type ProjectStatus = "draft" | "active" | "done";

export interface Project {
  id: string;
  ideaId: string;
  name: string;
  productPlan: string;
  architecture: string;
  status: ProjectStatus;
}
