import { IdeaToProjectWorkflow } from "../application/workflows/idea-to-project-workflow";

export class IdeaWorker {
  constructor(private readonly workflow: IdeaToProjectWorkflow) {}

  async runOnce(): Promise<void> {
    const summary = await this.workflow.runOnce();
    console.log(
      `Ideas processed=${summary.processedIdeas}, projects=${summary.createdProjects}, tasks=${summary.createdTasks}, issues=${summary.createdIssues}`,
    );
  }
}
