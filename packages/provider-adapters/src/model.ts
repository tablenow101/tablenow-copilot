export interface ModelPrompt {
  system: string;
  message: string;
  context: Record<string, unknown>;
}

export interface ModelResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostEur: number;
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
          { role: "user", content: `${prompt.message}\n\nContexte vérifié:\n${JSON.stringify(prompt.context)}` },
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
    return {
      text: body.choices?.[0]?.message?.content?.trim() || "Je n'ai pas pu produire une réponse exploitable.",
      model: body.model || this.options.model,
      inputTokens: body.usage?.prompt_tokens || 0,
      outputTokens: body.usage?.completion_tokens || 0,
      estimatedCostEur: 0,
    };
  }
}
