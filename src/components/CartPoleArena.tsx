import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cartPoleAgents } from "../data/content";
import {
  preloadBrowserCartPoleAgents,
  rankedActionsFromBrowserCartPoleAgent,
} from "../lib/browserCartPoleAgents";
import {
  cartPoleObservation,
  cartPoleScore,
  chooseCartPoleHeuristicAction,
  createCartPoleState,
  stepCartPole,
  type CartPoleAction,
  type CartPoleState,
} from "../lib/cartPoleCore";
import type { TaxiAgentProfile } from "../lib/types";

interface CartPoleLaneState {
  agent: TaxiAgentProfile;
  state: CartPoleState;
  reward: number;
  steps: number;
  done: boolean;
  lastAction: string;
  source: "local" | "onnx";
}

function createLane(agent: TaxiAgentProfile, index: number): CartPoleLaneState {
  return {
    agent,
    state: createCartPoleState(index + 5),
    reward: 0,
    steps: 0,
    done: false,
    lastAction: "ready",
    source: "local",
  };
}

function createLanes() {
  return cartPoleAgents.map(createLane);
}

export function CartPoleArena({ compact = false }: { compact?: boolean }) {
  const [lanes, setLanes] = useState<CartPoleLaneState[]>(() => createLanes());
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(120);
  const [apiStatus, setApiStatus] = useState("CartPole-v1 local while models load");
  const [browserAgents, setBrowserAgents] = useState<Set<string>>(() => new Set());
  const frameRef = useRef(0);
  const lanesRef = useRef(lanes);
  const browserAgentsRef = useRef(browserAgents);
  const modelActionRef = useRef(new Map<string, CartPoleAction>());
  const pendingModelRef = useRef(new Set<string>());

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    browserAgentsRef.current = browserAgents;
  }, [browserAgents]);

  useEffect(() => {
    if (!lanes.some((lane) => lane.source === "onnx")) {
      return;
    }

    const loadedCount =
      browserAgents.size || lanes.filter((lane) => lane.source === "onnx").length;
    setApiStatus(`CartPole-v1 ONNX active locally: ${loadedCount}/3`);
  }, [browserAgents.size, lanes]);

  useEffect(() => {
    let cancelled = false;

    async function warmupBrowserModels() {
      setApiStatus("CartPole-v1 local while models load");
      const loadedAgents = await preloadBrowserCartPoleAgents();
      if (cancelled) {
        return;
      }

      browserAgentsRef.current = loadedAgents;
      setBrowserAgents(loadedAgents);
      setApiStatus(
        loadedAgents.size > 0
          ? `CartPole-v1 ONNX loaded locally: ${loadedAgents.size}/3, running`
          : "CartPole-v1 local fallback",
      );
      if (loadedAgents.size > 0) {
        window.setTimeout(() => advanceLanes(), 0);
      }
    }

    void warmupBrowserModels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setInterval(() => {
      advanceLanes();
    }, speed);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const statusTone = useMemo(
    () => (apiStatus.includes("active") ? "online" : "offline"),
    [apiStatus],
  );

  function queueModelAction(lane: CartPoleLaneState) {
    if (
      lane.agent.id === "random-baseline" ||
      !browserAgentsRef.current.has(lane.agent.id) ||
      pendingModelRef.current.has(lane.agent.id)
    ) {
      return;
    }

    pendingModelRef.current.add(lane.agent.id);
    void rankedActionsFromBrowserCartPoleAgent(lane.agent.id, lane.state)
      .then((rankedActions) => {
        if (!rankedActions?.length) {
          return;
        }

        const currentScore = cartPoleScore(lane.state);
        const bestAction =
          rankedActions.find((candidate) => {
            const result = stepCartPole(lane.state, candidate, lane.steps);
            return !result.terminated && cartPoleScore(result.nextState) <= currentScore + 0.08;
          }) ?? rankedActions[0];

        modelActionRef.current.set(lane.agent.id, bestAction);
      })
      .finally(() => {
        pendingModelRef.current.delete(lane.agent.id);
      });
  }

  function actionForLane(lane: CartPoleLaneState, index: number) {
    if (lane.agent.id === "random-baseline") {
      return {
        action: (Math.random() > 0.5 ? 1 : 0) as CartPoleAction,
        source: "local" as const,
      };
    }

    if (!browserAgentsRef.current.has(lane.agent.id)) {
      return {
        action: chooseCartPoleHeuristicAction(lane.state),
        source: "local" as const,
      };
    }

    queueModelAction(lane);

    return {
      action: modelActionRef.current.get(lane.agent.id) ?? chooseCartPoleHeuristicAction(lane.state),
      source: "onnx" as const,
    };
  }

  function advanceLanes() {
    frameRef.current += 1;
    const nextLanes: CartPoleLaneState[] = [];
    for (let index = 0; index < lanesRef.current.length; index += 1) {
      const lane = lanesRef.current[index];
      if (!lane || lane.done || lane.steps >= 500) {
        nextLanes.push(createLane(lane?.agent ?? cartPoleAgents[index], frameRef.current + index + 17));
        continue;
      }

      const decision = actionForLane(lane, index);
      const result = stepCartPole(lane.state, decision.action, lane.steps);
      nextLanes.push({
        ...lane,
        state: result.nextState,
        reward: lane.reward + result.reward,
        steps: lane.steps + 1,
        done: result.terminated || result.truncated,
        lastAction: result.actionName,
        source: decision.source,
      });
    }

    setLanes(nextLanes);
  }

  function resetArena() {
    setLanes(createLanes());
  }

  return (
    <div className={["cartpole-arena", compact ? "cartpole-arena--compact" : ""].join(" ")}>
      <div className="cartpole-arena__bar">
        <div>
          <span className={`connection-dot connection-dot--${statusTone}`} />
          <span>{apiStatus}</span>
        </div>
        <button
          className="icon-button"
          onClick={() => setPlaying((value) => !value)}
          title={playing ? "Pause" : "Start"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button className="icon-button" onClick={resetArena} title="Reset">
          <RotateCcw size={18} />
        </button>
        <label className="speed-control">
          <span>speed</span>
          <input
            type="range"
            min="60"
            max="450"
            step="10"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="cartpole-grid-layout">
        {lanes.map((lane) => (
          <CartPoleLane key={lane.agent.id} lane={lane} />
        ))}
      </div>
    </div>
  );
}

function CartPoleLane({ lane }: { lane: CartPoleLaneState }) {
  const observation = cartPoleObservation(lane.state);

  return (
    <article
      className="cartpole-lane"
      style={{ "--agent-accent": lane.agent.accent } as CSSProperties}
    >
      <div className="cartpole-lane__header">
        <div>
          <h3>{lane.agent.name}</h3>
          <p>{lane.agent.style}</p>
        </div>
        <span>{lane.steps}</span>
      </div>

      <CartPoleVisual state={lane.state} />

      <dl className="agent-metrics cartpole-metrics">
        <div>
          <dt>action</dt>
          <dd>{lane.lastAction}</dd>
        </div>
        <div>
          <dt>source</dt>
          <dd>{lane.source}</dd>
        </div>
        <div>
          <dt>theta</dt>
          <dd>{lane.state.theta.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="cartpole-observation">
        [{observation.map((value) => value.toFixed(2)).join(", ")}]
      </p>
    </article>
  );
}

function CartPoleVisual({ state }: { state: CartPoleState }) {
  const cartPercent = 50 + (Math.max(-2.4, Math.min(2.4, state.x)) / 2.4) * 42;
  const poleDegrees = (state.theta * 180) / Math.PI;

  return (
    <div className="cartpole-visual" aria-label="CartPole-v1 render">
      <div className="cartpole-track" />
      <div className="cartpole-limit cartpole-limit--left" />
      <div className="cartpole-limit cartpole-limit--right" />
      <div className="cartpole-cart" style={{ left: `${cartPercent}%` }}>
        <span
          className="cartpole-pole"
          style={{ transform: `translateX(-50%) rotate(${poleDegrees}deg)` }}
        />
        <span className="cartpole-joint" />
        <span className="cartpole-wheel cartpole-wheel--left" />
        <span className="cartpole-wheel cartpole-wheel--right" />
      </div>
    </div>
  );
}
