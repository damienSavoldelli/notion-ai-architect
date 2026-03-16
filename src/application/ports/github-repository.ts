export interface CreateIssueInput {
  title: string;
  body: string;
  labels?: ReadonlyArray<string>;
}

export interface GitHubRepository {
  createIssue(input: CreateIssueInput): Promise<string>;
}
