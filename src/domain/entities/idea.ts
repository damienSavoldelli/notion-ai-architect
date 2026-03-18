export type IdeaStatus = "new" | "processing" | "done" | "error";

export interface Idea {
  id: string;
  title: string;
  status: IdeaStatus;
  createdAt: Date;
}
