export interface ModelPrompt {
  system: string;
  message: string;
  context: Record<string, unknown>;
}

export interface ModelResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostEur: number | null;
}

export interface ModelProvider {
  complete(prompt: ModelPrompt): Promise<ModelResult>;
}

export class OpenAICompatibleProvider implements ModelProvider {
  public constructor(
    private readonly options: { baseUrl: string; apiKey?: string; model: string },
  ) {}

  public async complete(prompt: ModelPrompt): Promise<ModelResult> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: `${prompt.message}\n\nContexte structuré (respecter la provenance et les limites de chaque section):\n${JSON.stringify(prompt.context)}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`MODEL_PROVIDER_${response.status}`);
    const body = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("MODEL_PROVIDER_EMPTY_RESPONSE");
    const measuredTokens = (value: unknown): number | null => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
    return {
      text: text.trim(),
      model: body.model || this.options.model,
      inputTokens: measuredTokens(body.usage?.prompt_tokens),
      outputTokens: measuredTokens(body.usage?.completion_tokens),
      estimatedCostEur: null,
    };
  }
}
