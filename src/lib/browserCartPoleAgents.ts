import type { CartPoleAction, CartPoleState } from "./cartPoleCore";
import { cartPoleObservation } from "./cartPoleCore";

const browserAgentUrls: Record<string, string> = {
  expected_sarsa: "/education/powerpoint/models/cartpole_expected_sarsa_float32.onnx",
  mountain_car_reinforce: "/education/powerpoint/models/cartpole_reinforce_float32.onnx",
  actor_critic_mountain: "/education/powerpoint/models/cartpole_actor_critic_float32.onnx",
};

interface LoadedBrowserAgent {
  inputName: string;
  outputName: string;
  rank(state: CartPoleState): Promise<CartPoleAction[]>;
}

const agentCache = new Map<string, Promise<LoadedBrowserAgent | null>>();
let globalOnnxRunQueue = Promise.resolve();
const failedInferenceLogs = new Set<string>();

function enqueueOnnxRun<T>(task: () => Promise<T>): Promise<T> {
  const nextRun = globalOnnxRunQueue.catch(() => undefined).then(task);
  globalOnnxRunQueue = nextRun.then(
    () => undefined,
    () => undefined,
  );
  return nextRun;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
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

function rankActions(values: ArrayLike<number>): CartPoleAction[] {
  return [0, 1]
    .map((action) => ({
      action: action as CartPoleAction,
      value: values[action] ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((left, right) => right.value - left.value)
    .map((item) => item.action);
}

function chooseFallbackAction(state: CartPoleState): CartPoleAction {
  return state.theta + state.thetaDot * 0.25 + state.x * 0.08 > 0 ? 1 : 0;
}

function invertAction(action: CartPoleAction): CartPoleAction {
  return action === 1 ? 0 : 1;
}

export function hasBrowserCartPoleAgent(agentId: string) {
  return agentId in browserAgentUrls;
}

export function browserCartPoleAgentIds() {
  return Object.keys(browserAgentUrls);
}

async function loadAgent(agentId: string): Promise<LoadedBrowserAgent | null> {
  const url = browserAgentUrls[agentId];
  if (!url) {
    return null;
  }

  try {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    const response = await fetch(`${url}?v=cartpole-float32-20260518-new-rl`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }

    const modelBuffer = await response.arrayBuffer();
    const session = await withTimeout(
      ort.InferenceSession.create(modelBuffer, { executionProviders: ["wasm"] }),
      6000,
    );
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    let runCount = 0;

    if (import.meta.env.DEV) {
      console.info("[CartPole ONNX] loaded", {
        agentId,
        url,
        inputs: session.inputNames,
        outputs: session.outputNames,
        inputMetadata: session.inputMetadata,
        outputMetadata: session.outputMetadata,
      });
    }

    return {
      inputName,
      outputName,
      async rank(state: CartPoleState) {
        const observation = cartPoleObservation(state);

        return enqueueOnnxRun(async () => {
          const tensor = new ort.Tensor("float32", Float32Array.from(observation), [1, 4]);
          const result = await session.run({ [inputName]: tensor });
          const values = result[outputName].data as ArrayLike<number>;
          const ranked = rankActions(values);
          runCount += 1;

          if (import.meta.env.DEV && (runCount === 1 || runCount % 25 === 0)) {
            console.debug("[CartPole ONNX] real inference", {
              agentId,
              runCount,
              modelUrl: url,
              inputName,
              outputName,
              observation: observation.map((value) => Number(value.toFixed(4))),
              actionValues: Array.from(values).map((value) => Number(value.toFixed(4))),
              rankedActions: ranked,
              chosenAction: ranked[0],
            });
          }

          return ranked;
        }).catch((error) => {
          if (import.meta.env.DEV && !failedInferenceLogs.has(agentId)) {
            failedInferenceLogs.add(agentId);
            console.warn("[CartPole ONNX] inference failed, using heuristic fallback", {
              agentId,
              modelUrl: url,
              inputMetadata: session.inputMetadata,
              outputMetadata: session.outputMetadata,
              error,
            });
          }
          const fallback = chooseFallbackAction(state);
          return [fallback, invertAction(fallback)];
        });
      },
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Could not load browser CartPole agent ${agentId}`, error);
    }
    return null;
  }
}

async function getBrowserAgent(agentId: string) {
  if (!hasBrowserCartPoleAgent(agentId)) {
    return null;
  }

  if (!agentCache.has(agentId)) {
    agentCache.set(agentId, withTimeout(loadAgent(agentId), 15000).catch(() => null));
  }

  return (await agentCache.get(agentId)) ?? null;
}

export async function rankedActionsFromBrowserCartPoleAgent(
  agentId: string,
  state: CartPoleState,
): Promise<CartPoleAction[] | null> {
  try {
    const agent = await getBrowserAgent(agentId);
    return agent ? agent.rank(state) : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[CartPole ONNX] agent unavailable", {
        agentId,
        error,
      });
    }
    return null;
  }
}

export async function preloadBrowserCartPoleAgents() {
  const results: Array<{ agentId: string; loaded: boolean }> = [];

  for (const agentId of browserCartPoleAgentIds()) {
    const agent = await getBrowserAgent(agentId);
    results.push({
      agentId,
      loaded: Boolean(agent),
    });
  }

  return new Set(results.filter((result) => result.loaded).map((result) => result.agentId));
}
