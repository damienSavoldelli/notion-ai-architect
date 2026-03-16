import { Octokit } from "@octokit/rest";
import type {
  CreateIssueInput,
  GitHubRepository,
} from "../../application/ports/github-repository";

interface OctokitIssuesApi {
  create(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: Array<string>;
  }): Promise<unknown>;
}

interface OctokitSdk {
  issues: OctokitIssuesApi;
}

export interface GitHubClientConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubClient implements GitHubRepository {
  private readonly octokit: OctokitSdk;

  constructor(
    private readonly config: GitHubClientConfig,
    octokitSdk?: OctokitSdk,
  ) {
    this.octokit = octokitSdk ?? new Octokit({ auth: config.token });
  }

  async createIssue(input: CreateIssueInput): Promise<string> {
    const response = await this.octokit.issues.create({
      owner: this.config.owner,
      repo: this.config.repo,
      title: input.title,
      body: input.body,
      labels: input.labels ? [...input.labels] : undefined,
    });

    const issueUrl = extractIssueUrl(response);
    if (!issueUrl) {
      throw new Error("GitHub create issue response did not include html_url.");
    }

    return issueUrl;
  }
}

const extractIssueUrl = (response: unknown): string | null => {
  if (!isObject(response) || !isObject(response.data)) {
    return null;
  }

  const issueUrl = response.data.html_url;
  return typeof issueUrl === "string" && issueUrl.length > 0 ? issueUrl : null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
