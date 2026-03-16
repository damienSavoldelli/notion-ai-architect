export type IdeaStatus = "new" | "processing" | "done";

export interface Idea {
  id: string;
  title: string;
  status: IdeaStatus;
  createdAt: Date;
}
