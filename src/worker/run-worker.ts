import { loadEnv } from "../config/env";
import { IdeaToProjectWorkflow } from "../application/workflows/idea-to-project-workflow";
import { OpenAiArchitectClient } from "../infrastructure/ai/openai-architect-client";
import { GitHubClient } from "../infrastructure/github/github-client";
import { NotionClient } from "../infrastructure/notion/notion-client";
import { IdeaWorker } from "./idea-worker";

const main = async (): Promise<void> => {
  const env = loadEnv(process.env);

  const notionRepository = new NotionClient({
    authToken: env.NOTION_API_TOKEN,
    ideasDatabaseId: env.NOTION_IDEAS_DATABASE_ID,
    projectsDatabaseId: env.NOTION_PROJECTS_DATABASE_ID,
    tasksDatabaseId: env.NOTION_TASKS_DATABASE_ID,
  });
  const aiArchitectService = new OpenAiArchitectClient({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  });
  const githubRepository = new GitHubClient({
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
  });

  const workflow = new IdeaToProjectWorkflow(
    notionRepository,
    aiArchitectService,
    githubRepository,
  );

  const worker = new IdeaWorker(workflow);
  await worker.runOnce();
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Worker execution failed.", error);
    process.exit(1);
  });
}
