import Fastify from "fastify";
import type { WorkflowRunSummary } from "../application/workflows/idea-to-project-workflow";

interface WorkerRunner {
  runOnce(): Promise<WorkflowRunSummary>;
}

interface ApiServerOptions {
  workerRunBearerToken?: string;
}

export const buildServer = (
  worker: WorkerRunner,
  options: ApiServerOptions = {},
) => {
  const server = Fastify({
    logger: false,
  });

  server.get("/", async () => ({
    name: "AI Workflow Architect",
    status: "running",
    description:
      "AI workflow engine transforming Notion ideas into GitHub issues",
    endpoints: {
      health: "/health",
      trigger: "/worker/run",
    },
  }));

  server.get("/health", async () => ({
    status: "ok",
  }));

  server.post("/worker/run", async (request, reply) => {
    if (options.workerRunBearerToken) {
      const authHeader = request.headers.authorization;
      const expected = `Bearer ${options.workerRunBearerToken}`;

      if (authHeader !== expected) {
        return reply.status(401).send({
          status: "error",
          message: "unauthorized",
        });
      }
    }

    const summary = await worker.runOnce();
    return reply.status(200).send({
      status: "ok",
      summary,
    });
  });

  return server;
};
