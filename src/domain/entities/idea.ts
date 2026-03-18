export type IdeaStatus = "new" | "processing" | "done" | "error";

export interface Idea {
  id: string;
  title: string;
  content?: string;
  status: IdeaStatus;
  createdAt: Date;
}
