import type { TaxiAction } from "./taxiCore";

const browserAgentUrls: Record<string, string> = {
  expected_sarsa: "/education/powerpoint/models/expected_sarsa.onnx",
  mountain_car_reinforce: "/education/powerpoint/models/mountain_car_reinforce.onnx",
  actor_critic_mountain: "/education/powerpoint/models/actor_critic_mountain.onnx",
};

interface LoadedBrowserAgent {
  inputName: string;
  outputName: string;
  run(observation: number): Promise<TaxiAction>;
  rank(observation: number): Promise<TaxiAction[]>;
}

const agentCache = new Map<string, Promise<LoadedBrowserAgent | null>>();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function hasBrowserTaxiAgent(agentId: string) {
  return agentId in browserAgentUrls;
}

export function browserTaxiAgentIds() {
  return Object.keys(browserAgentUrls);
}

function argmax(values: ArrayLike<number>) {
  let bestIndex = 0;
  let bestValue = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? Number.NEGATIVE_INFINITY;
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }

  return Math.max(0, Math.min(5, bestIndex)) as TaxiAction;
}

function rankActions(values: ArrayLike<number>): TaxiAction[] {
  return Array.from({ length: Math.min(6, values.length) }, (_, index) => ({
    action: index as TaxiAction,
    value: values[index] ?? Number.NEGATIVE_INFINITY,
  }))
    .sort((left, right) => right.value - left.value)
    .map((item) => item.action);
}

async function loadAgent(agentId: string): Promise<LoadedBrowserAgent | null> {
  const url = browserAgentUrls[agentId];
  if (!url) {
    return null;
  }

  try {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    const modelResponse = await fetch(url, { cache: "force-cache" });
    if (!modelResponse.ok) {
      return null;
    }

    const modelBuffer = await modelResponse.arrayBuffer();
    const session = await withTimeout(
      ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
      }),
      6000,
    );
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    const runRanked = async (observation: number) => {
      const tensor = new ort.Tensor(
        "int64",
        BigInt64Array.from([BigInt(observation)]),
        [1],
      );
      const result = await withTimeout(session.run({ [inputName]: tensor }), 1200);
      const output = result[outputName];
      return rankActions(output.data as ArrayLike<number>);
    };

    return {
      inputName,
      outputName,
      rank: runRanked,
      async run(observation: number) {
        const ranked = await runRanked(observation);
        return ranked[0] ?? 0;
      },
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Could not load browser ONNX taxi agent ${agentId}`, error);
    }
    return null;
  }
}

async function getBrowserAgent(agentId: string) {
  if (!hasBrowserTaxiAgent(agentId)) {
    return null;
  }

  if (!agentCache.has(agentId)) {
    agentCache.set(agentId, loadAgent(agentId));
  }

  return (await agentCache.get(agentId)) ?? null;
}

export async function actionFromBrowserTaxiAgent(
  agentId: string,
  observation: number,
): Promise<TaxiAction | null> {
  const agent = await getBrowserAgent(agentId);
  if (!agent) {
    return null;
  }

  return agent.run(observation);
}

export async function rankedActionsFromBrowserTaxiAgent(
  agentId: string,
  observation: number,
): Promise<TaxiAction[] | null> {
  const agent = await getBrowserAgent(agentId);
  if (!agent) {
    return null;
  }

  return agent.rank(observation);
}

export async function preloadBrowserTaxiAgents() {
  const results: Array<{ agentId: string; loaded: boolean }> = [];
  for (const agentId of browserTaxiAgentIds()) {
    results.push({
      agentId,
      loaded: (await actionFromBrowserTaxiAgent(agentId, 0)) !== null,
    });
  }

  return new Set(results.filter((result) => result.loaded).map((result) => result.agentId));
}
