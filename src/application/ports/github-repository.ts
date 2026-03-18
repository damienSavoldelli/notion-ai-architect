export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: ReadonlyArray<string>;
}

export interface GitHubRepository {
  findIssueUrlByTitle?(title: string): Promise<string | null>;
  createIssue(input: CreateIssueInput): Promise<string>;
}
