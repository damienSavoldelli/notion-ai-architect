import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../../src/api/server";

describe("API server", () => {
  it("returns health status", async () => {
    const server = buildServer({
      runOnce: vi.fn().mockResolvedValue({
        processedIdeas: 0,
        createdProjects: 0,
        createdTasks: 0,
        createdIssues: 0,
      }),
    });

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });

    await server.close();
  });

  it("triggers worker run and returns summary", async () => {
    const runOnce = vi.fn().mockResolvedValue({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 3,
      createdIssues: 3,
    });
    const server = buildServer({ runOnce });

    const response = await server.inject({
      method: "POST",
      url: "/worker/run",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      summary: {
        processedIdeas: 1,
        createdProjects: 1,
        createdTasks: 3,
        createdIssues: 3,
      },
    });
    expect(runOnce).toHaveBeenCalledTimes(1);

    await server.close();
  });

  it("rejects worker run when bearer token is missing or invalid", async () => {
    const runOnce = vi.fn().mockResolvedValue({
      processedIdeas: 1,
      createdProjects: 1,
      createdTasks: 1,
      createdIssues: 1,
    });
    const server = buildServer(
      { runOnce },
      { workerRunBearerToken: "demo-secret-token" },
    );

    const missingToken = await server.inject({
      method: "POST",
      url: "/worker/run",
    });
    expect(missingToken.statusCode).toBe(401);
    expect(missingToken.json()).toEqual({
      status: "error",
      message: "unauthorized",
    });

    const wrongToken = await server.inject({
      method: "POST",
      url: "/worker/run",
      headers: {
        authorization: "Bearer wrong-token",
      },
    });
    expect(wrongToken.statusCode).toBe(401);
    expect(runOnce).not.toHaveBeenCalled();

    await server.close();
  });

  it("allows worker run with valid bearer token", async () => {
    const runOnce = vi.fn().mockResolvedValue({
      processedIdeas: 2,
      createdProjects: 2,
      createdTasks: 4,
      createdIssues: 4,
    });
    const server = buildServer(
      { runOnce },
      { workerRunBearerToken: "demo-secret-token" },
    );

    const response = await server.inject({
      method: "POST",
      url: "/worker/run",
      headers: {
        authorization: "Bearer demo-secret-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      summary: {
        processedIdeas: 2,
        createdProjects: 2,
        createdTasks: 4,
        createdIssues: 4,
      },
    });
    expect(runOnce).toHaveBeenCalledTimes(1);

    await server.close();
  });
});
