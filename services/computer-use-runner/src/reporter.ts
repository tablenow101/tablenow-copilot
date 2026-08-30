import type { ComputerNodeEventInput } from "@tablenow/contracts";
import { NodeClient } from "./client.js";
import type { ClaimedRun } from "./types.js";

export class RunReporter {
  private sequence: number;

  public constructor(private readonly client: NodeClient, private readonly run: ClaimedRun) {
    this.sequence = run.nextSequence - 1;
  }

  public async event(
    kind: ComputerNodeEventInput["kind"],
    message: string,
    status: ComputerNodeEventInput["status"] = "info",
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    this.sequence += 1;
    await this.client.event(this.run, { sequence: this.sequence, kind, status, message, metadata });
  }

  public async evidence(label: string, png: Buffer): Promise<void> {
    this.sequence += 1;
    await this.client.evidence(this.run, this.sequence, label, png);
  }
}
