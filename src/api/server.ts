import Fastify from "fastify";
import type { WorkflowRunSummary } from "../application/workflows/idea-to-project-workflow";

interface WorkerRunner {
  runOnce(): Promise<WorkflowRunSummary>;
}

export const buildServer = (worker: WorkerRunner) => {
  const server = Fastify({
    logger: false,
  });

  server.get("/health", async () => ({
    status: "ok",
  }));

  server.post("/worker/run", async (_request, reply) => {
    const summary = await worker.runOnce();
    return reply.status(200).send({
      status: "ok",
      summary,
    });
  });

  return server;
};
