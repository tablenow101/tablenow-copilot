import type { ComputerWorkflowStep } from "@tablenow/contracts";
import { requiresPointOfActionApproval } from "@tablenow/domain";
import type { Locator, Page } from "playwright-core";
import { assertCurrentPageAllowed, launchRestrictedBrowser } from "./browser.js";
import { NodeClient } from "./client.js";
import { RunReporter } from "./reporter.js";
import { assertAllowedUrl, assertFinalControlAllowed, detectPromptInjection, interpolate, SecurityBlockError } from "./safety.js";
import type { ClaimedRun, RunnerConfig, RunResult } from "./types.js";

type LocatorSpec = Extract<ComputerWorkflowStep, { action: "click" }>["locator"];

export async function executePlaywrightWorkflow(
  run: ClaimedRun,
  config: RunnerConfig,
  client: NodeClient,
  reporter: RunReporter,
): Promise<RunResult> {
  const { context, page } = await launchRestrictedBrowser(run, config);
  try {
    assertAllowedUrl(run.workflow.definition.startUrl, run.connection.allowedHosts);
    const steps = run.workflow.definition.steps.slice(0, run.workflow.definition.maxSteps);
    for (const [index, step] of steps.entries()) {
      if (await client.cancelled(run)) {
        return { status: "cancelled", summary: "Exécution arrêtée à la demande de l’utilisateur.", output: { completedSteps: index } };
      }
      await reporter.event("step_started", stepLabel(step), "info", { stepId: step.id, action: step.action });
      await executeStep(page, run, reporter, step);
      assertCurrentPageAllowed(page, run.connection.allowedHosts);
      await reporter.event("step_completed", `${stepLabel(step)} terminé`, "succeeded", { stepId: step.id, action: step.action });
    }
    const finalScreenshot = await page.screenshot({ type: "png" });
    await reporter.evidence("État final vérifié", finalScreenshot);
    return {
      status: "succeeded",
      summary: run.workflow.definition.expectedOutcome,
      output: { finalUrl: page.url(), completedSteps: steps.length, verification: "deterministic" },
    };
  } catch (error) {
    return failureResult(error);
  } finally {
    await context.close();
  }
}

async function executeStep(page: Page, run: ClaimedRun, reporter: RunReporter, step: ComputerWorkflowStep): Promise<void> {
  switch (step.action) {
    case "goto": {
      const url = interpolate(step.url, run.inputs);
      assertAllowedUrl(url, run.connection.allowedHosts);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await reporter.event("navigation", `Navigation autorisée vers ${new URL(url).origin}`, "succeeded");
      break;
    }
    case "click": {
      await assertPageContentSafe(page);
      const locator = locate(page, step.locator);
      await locator.waitFor({ state: "visible" });
      const targetText = await controlText(locator);
      assertFinalControlAllowed(run, targetText);
      if (requiresPointOfActionApproval(targetText)) {
        await reporter.evidence("Avant action sensible", await page.screenshot({ type: "png" }));
      }
      await locator.click();
      break;
    }
    case "fill": {
      await assertPageContentSafe(page);
      await locate(page, step.locator).fill(interpolate(step.value, run.inputs));
      break;
    }
    case "select": {
      await assertPageContentSafe(page);
      await locate(page, step.locator).selectOption(interpolate(step.value, run.inputs));
      break;
    }
    case "press":
      if (step.key.toLowerCase().includes("enter")) {
        assertFinalControlAllowed(run, await activeControlText(page));
      }
      await page.keyboard.press(step.key);
      break;
    case "wait":
      await page.waitForTimeout(step.milliseconds);
      break;
    case "verify": {
      const locator = locate(page, step.locator);
      await locator.waitFor({ state: "visible" });
      if (step.contains) {
        const text = (await locator.innerText()).normalize("NFKC");
        if (!text.includes(interpolate(step.contains, run.inputs))) throw new Error(`VERIFY_TEXT_MISMATCH:${step.id}`);
      }
      await reporter.event("verification", "Résultat visible confirmé", "succeeded", { stepId: step.id });
      break;
    }
    case "screenshot":
      await reporter.evidence(step.label, await page.screenshot({ type: "png" }));
      break;
  }
}

function locate(page: Page, locator: LocatorSpec): Locator {
  switch (locator.kind) {
    case "role":
      return page.getByRole(locator.role as Parameters<Page["getByRole"]>[0], { name: locator.name, exact: true });
    case "label":
      return page.getByLabel(locator.value, { exact: true });
    case "text":
      return page.getByText(locator.value, { exact: locator.exact });
    case "testId":
      return page.getByTestId(locator.value);
    case "css":
      return page.locator(locator.value);
  }
}

async function assertPageContentSafe(page: Page): Promise<void> {
  const visibleText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const warning = detectPromptInjection(visibleText);
  if (warning) throw new SecurityBlockError("PROMPT_INJECTION_DETECTED", warning);
}

async function controlText(locator: Locator): Promise<string> {
  return locator.evaluate((element) => [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent,
  ].filter(Boolean).join(" ")).catch(() => "");
}

async function activeControlText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    return element ? [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent].filter(Boolean).join(" ") : "";
  });
}

function stepLabel(step: ComputerWorkflowStep): string {
  const labels: Record<ComputerWorkflowStep["action"], string> = {
    goto: "Ouvrir l’interface",
    click: "Activer le contrôle",
    fill: "Renseigner le champ",
    select: "Choisir l’option",
    press: "Utiliser le clavier",
    wait: "Attendre la réponse",
    verify: "Vérifier le résultat",
    screenshot: "Conserver la preuve",
  };
  return labels[step.action];
}

function failureResult(error: unknown): RunResult {
  if (error instanceof SecurityBlockError) {
    return { status: "blocked", summary: error.message, output: {}, errorCode: error.code };
  }
  const code = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message.slice(0, 120) : "PLAYWRIGHT_WORKFLOW_FAILED";
  return { status: "failed", summary: "Le scénario n’a pas atteint son résultat attendu.", output: {}, errorCode: code };
}
