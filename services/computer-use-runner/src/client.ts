import type { ComputerNodeCompleteInput, ComputerNodeEventInput } from "@tablenow/contracts";
import type { ClaimedRun, RunnerConfig } from "./types.js";

export class NodeClient {
  public constructor(private readonly config: RunnerConfig) {}

  public async heartbeat(browserVersion?: string): Promise<void> {
    await this.request("/v1/node/computer-use/heartbeat", {
      method: "POST",
      body: JSON.stringify({
        version: "0.1.0",
        platform: `${process.platform}-${process.arch}`,
        capabilities: ["browser.playwright", "browser.evidence", "browser.allowlist", ...(this.config.openAiApiKey ? ["browser.openai-computer"] : [])],
        ...(browserVersion ? { browserVersion } : {}),
      }),
    });
  }

  public async claim(): Promise<ClaimedRun | null> {
    return this.request<ClaimedRun | null>("/v1/node/computer-use/claim", { method: "POST" }, true);
  }

  public async event(run: ClaimedRun, event: Omit<ComputerNodeEventInput, "claimToken">): Promise<void> {
    await this.request(`/v1/node/computer-use/runs/${run.id}/events`, {
      method: "POST",
      body: JSON.stringify({ ...event, claimToken: run.claimToken }),
    });
  }

  public async evidence(run: ClaimedRun, sequence: number, label: string, png: Buffer): Promise<void> {
    await this.request(`/v1/node/computer-use/runs/${run.id}/evidence`, {
      method: "POST",
      body: JSON.stringify({ claimToken: run.claimToken, sequence, label, pngBase64: png.toString("base64") }),
    }, false, 30_000);
  }

  public async complete(run: ClaimedRun, result: Omit<ComputerNodeCompleteInput, "claimToken">): Promise<void> {
    await this.request(`/v1/node/computer-use/runs/${run.id}/complete`, {
      method: "POST",
      body: JSON.stringify({ ...result, claimToken: run.claimToken }),
    });
  }

  public async cancelled(run: ClaimedRun): Promise<boolean> {
    const result = await this.request<{ cancelled: boolean }>(`/v1/node/computer-use/runs/${run.id}/control`, {
      method: "POST",
      body: JSON.stringify({ claimToken: run.claimToken }),
    });
    return result.cancelled;
  }

  private async request<T = unknown>(path: string, init: RequestInit, allowNoContent = false, timeout = 20_000): Promise<T> {
    const response = await fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.config.nodeToken}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(timeout),
    });
    if (allowNoContent && response.status === 204) return null as T;
    const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) throw new Error(`NODE_API_${response.status}:${JSON.stringify(body)}`);
    return body as T;
  }
}
