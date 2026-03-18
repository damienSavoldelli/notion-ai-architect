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
  listForRepo(params: {
    owner: string;
    repo: string;
    state?: "open" | "closed" | "all";
    per_page?: number;
    page?: number;
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

  async findIssueUrlByTitle(title: string): Promise<string | null> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return null;
    }

    const maxPages = 5;
    const perPage = 100;

    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.octokit.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        state: "all",
        per_page: perPage,
        page,
      });

      const issues = extractIssueList(response);
      for (const issue of issues) {
        if (issue.pullRequest) {
          continue;
        }

        if (issue.title === trimmedTitle && issue.url) {
          return issue.url;
        }
      }

      if (issues.length < perPage) {
        break;
      }
    }

    return null;
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

interface GitHubIssueListItem {
  title: string;
  url: string | null;
  pullRequest: boolean;
}

const extractIssueList = (response: unknown): ReadonlyArray<GitHubIssueListItem> => {
  if (!isObject(response) || !Array.isArray(response.data)) {
    return [];
  }

  return response.data
    .filter(isObject)
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "",
      url: typeof item.html_url === "string" ? item.html_url : null,
      pullRequest: isObject(item.pull_request),
    }));
};
