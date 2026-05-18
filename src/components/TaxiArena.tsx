import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Pause, Play, RotateCcw, Unplug, Wifi } from "lucide-react";
import { taxiAgents } from "../data/content";
import {
  actionFromBrowserTaxiAgent,
  hasBrowserTaxiAgent,
  preloadBrowserTaxiAgents,
  rankedActionsFromBrowserTaxiAgent,
} from "../lib/browserTaxiAgents";
import {
  actionNames,
  chooseLocalAction,
  createTaxiState,
  encodeTaxiObservation,
  stepTaxi,
  taxiLandmarks,
  type TaxiAction,
  type TaxiState,
} from "../lib/taxiCore";
import type { TaxiAgentProfile } from "../lib/types";

interface LaneState {
  agent: TaxiAgentProfile;
  taxi: TaxiState;
  observation: number;
  reward: number;
  steps: number;
  done: boolean;
  lastAction: string;
  source: "local" | "gymnasium" | "onnx";
  renderText?: string;
}

interface GymTaxiPayload {
  observation: number;
  decoded_state: {
    taxi_row: number;
    taxi_col: number;
    passenger: number;
    destination: number;
  };
  reward: number;
  terminated: boolean;
  truncated: boolean;
  render_text?: string;
}

const apiDefault =
  import.meta.env.VITE_PURCAR_AGENT_API_URL || "http://127.0.0.1:8027";

const taxiAnsiTemplate = [
  "+---------+",
  "|R: | : :G|",
  "| : | : : |",
  "| : : : : |",
  "| | : | : |",
  "|Y| : |B: |",
  "+---------+",
];

function renderLocalGymnasiumTaxi(state: TaxiState, action: string) {
  const rows = taxiAnsiTemplate.map((row) => row.split(""));
  const colSlots = [1, 3, 5, 7, 9];
  const taxiLine = state.taxiRow + 1;
  const taxiCol = colSlots[state.taxiCol];
  rows[taxiLine][taxiCol] = state.passenger === 4 ? "D" : "T";

  return [
    rows.map((row) => row.join("")).join("\n"),
    `  (${action})`,
    "Taxi-v3",
  ].join("\n");
}

function createLane(agent: TaxiAgentProfile, index: number): LaneState {
  const taxi = createTaxiState(index + 1);
  return {
    agent,
    taxi,
    observation: encodeTaxiObservation(taxi),
    reward: 0,
    steps: 0,
    done: false,
    lastAction: "ready",
    source: "local",
  };
}

function createLanes(): LaneState[] {
  return taxiAgents.map(createLane);
}

function taxiFromGym(payload: GymTaxiPayload): TaxiState {
  return {
    taxiRow: payload.decoded_state.taxi_row,
    taxiCol: payload.decoded_state.taxi_col,
    passenger: payload.decoded_state.passenger as TaxiState["passenger"],
    destination: payload.decoded_state.destination as TaxiState["destination"],
  };
}

function endpointBase(endpoint: string) {
  return endpoint.replace(/\/$/, "");
}

export function TaxiArena({ compact = false }: { compact?: boolean }) {
  const [lanes, setLanes] = useState<LaneState[]>(() => createLanes());
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(700);
  const [tick, setTick] = useState(0);
  const [endpoint, setEndpoint] = useState(apiDefault);
  const [apiStatus, setApiStatus] = useState("offline TS fallback");
  const [gymMode, setGymMode] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<Set<string>>(
    () => new Set(),
  );
  const [browserAgents, setBrowserAgents] = useState<Set<string>>(() => new Set());
  const busyRef = useRef(false);
  const lanesRef = useRef<LaneState[]>(lanes);

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    if (gymMode || !lanes.some((lane) => lane.source === "onnx")) {
      return;
    }

    const loadedCount =
      browserAgents.size || lanes.filter((lane) => lane.source === "onnx").length;
    setApiStatus(`browser ONNX active: ${loadedCount} models`);
  }, [browserAgents.size, gymMode, lanes]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setInterval(() => {
      setTick((value) => value + 1);

      if (gymMode) {
        void advanceGymLanes();
        return;
      }

      void advanceLocalLanes();
    }, speed);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, gymMode, tick, endpoint, availableAgents]);

  const statusTone = useMemo(
    () =>
      apiStatus.startsWith("gymnasium") || apiStatus.startsWith("browser ONNX active")
        ? "online"
        : "offline",
    [apiStatus],
  );

  useEffect(() => {
    let cancelled = false;

    async function warmupBrowserModels() {
      if (!compact) {
        return;
      }

      setApiStatus("loading browser ONNX models");
      const loadedAgents = await preloadBrowserTaxiAgents();
      if (cancelled) {
        return;
      }

      setBrowserAgents(loadedAgents);
      if (loadedAgents.size > 0) {
        setApiStatus(`browser ONNX active: ${loadedAgents.size} models`);
      } else {
        setApiStatus("browser ONNX missing, local fallback");
      }
    }

    void warmupBrowserModels();

    return () => {
      cancelled = true;
    };
  }, [compact]);

  async function fetchJson<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${endpointBase(endpoint)}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async function resetGymLane(agent: TaxiAgentProfile): Promise<LaneState> {
    const payload = await fetchJson<GymTaxiPayload>("/taxi-v3/session/reset", {
      session_id: agent.id,
    });
    const taxi = taxiFromGym(payload);
    return {
      agent,
      taxi,
      observation: payload.observation,
      reward: 0,
      steps: 0,
      done: false,
      lastAction: "gym reset",
      source: "gymnasium",
      renderText: payload.render_text,
    };
  }

  async function actionForLane(lane: LaneState, index: number): Promise<TaxiAction> {
    const browserAction = await actionFromBrowserTaxiAgent(
      lane.agent.id,
      lane.observation,
    );
    if (browserAction !== null) {
      return browserAction;
    }

    if (!availableAgents.has(lane.agent.id)) {
      return chooseLocalAction(lane.agent, lane.taxi, tick + index);
    }

    try {
      const payload = await fetchJson<{ action: number }>(
        `/agents/${lane.agent.id}/act`,
        { observation: lane.observation },
      );
      if (payload.action >= 0 && payload.action <= 5) {
        return payload.action as TaxiAction;
      }
    } catch {
      // If a local PyTorch model fails, keep the visual Gymnasium demo alive.
    }

    return chooseLocalAction(lane.agent, lane.taxi, tick + index);
  }

  async function advanceLocalLanes() {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      const nextLanes: LaneState[] = [];
      for (let index = 0; index < lanesRef.current.length; index += 1) {
        const lane = lanesRef.current[index];
        if (!lane || lane.done) {
          nextLanes.push(createLane(lane?.agent ?? taxiAgents[index], index + tick + 3));
          continue;
        }

        const rankedBrowserActions = await rankedActionsFromBrowserTaxiAgent(
          lane.agent.id,
          lane.observation,
        );
        let source: LaneState["source"] = rankedBrowserActions ? "onnx" : "local";
        let action =
          rankedBrowserActions?.[0] ?? chooseLocalAction(lane.agent, lane.taxi, tick + index);
        let result = stepTaxi(lane.taxi, action);

        if (rankedBrowserActions) {
          const validModelAction = rankedBrowserActions.find((candidate) => {
            const candidateResult = stepTaxi(lane.taxi, candidate);
            return (
              encodeTaxiObservation(candidateResult.nextState) !== lane.observation ||
              candidateResult.done
            );
          });

          if (validModelAction !== undefined) {
            action = validModelAction;
            result = stepTaxi(lane.taxi, action);
          } else {
            action = chooseLocalAction(lane.agent, lane.taxi, tick + index);
            result = stepTaxi(lane.taxi, action);
            source = "local";
          }
        }

        nextLanes.push({
          ...lane,
          taxi: result.nextState,
          observation: encodeTaxiObservation(result.nextState),
          reward: lane.reward + result.reward,
          steps: lane.steps + 1,
          done: result.done,
          lastAction: result.actionName,
          source,
        });
      }
      setLanes(nextLanes);
      if (nextLanes.some((lane) => lane.source === "onnx")) {
        const loadedCount =
          browserAgents.size || nextLanes.filter((lane) => lane.source === "onnx").length;
        setApiStatus(`browser ONNX active: ${loadedCount} models`);
      }
    } finally {
      busyRef.current = false;
    }
  }

  async function advanceGymLanes() {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    try {
      const nextLanes = await Promise.all(
        lanes.map(async (lane, index) => {
          if (lane.done || lane.steps >= 80) {
            return resetGymLane(lane.agent);
          }

          const action = await actionForLane(lane, index);
          const payload = await fetchJson<GymTaxiPayload>("/taxi-v3/session/step", {
            session_id: lane.agent.id,
            action,
          });
          const taxi = taxiFromGym(payload);
          return {
            ...lane,
            taxi,
            observation: payload.observation,
            reward: lane.reward + payload.reward,
            steps: lane.steps + 1,
            done: payload.terminated || payload.truncated,
            lastAction: actionNames[action],
            source: "gymnasium" as const,
            renderText: payload.render_text,
          };
        }),
      );
      setLanes(nextLanes);
    } catch {
      setGymMode(false);
      setApiStatus("offline TS fallback");
    } finally {
      busyRef.current = false;
    }
  }

  async function connectModels() {
    setApiStatus("connecting");
    try {
      const payload = await fetchJson<{ agents?: Array<{ id: string }> }>(
        "/agents",
      );
      setAvailableAgents(
        new Set(
          (payload.agents || [])
            .map((agent) => agent.id)
            .concat(
              taxiAgents
                .filter((agent) => hasBrowserTaxiAgent(agent.id))
                .map((agent) => agent.id),
            ),
        ),
      );

      const gymLanes = await Promise.all(
        taxiAgents.map((agent) => resetGymLane(agent)),
      );
      setLanes(gymLanes);
      setGymMode(true);
      setPlaying(true);
      setApiStatus(
        `gymnasium live: ${payload.agents?.length || 0} PyTorch models`,
      );
    } catch {
      setGymMode(false);
      setAvailableAgents(new Set());
      setPlaying(true);
      setApiStatus(compact ? "loading browser ONNX models" : "offline TS fallback");
    }
  }

  useEffect(() => {
    if (!compact) {
      return;
    }

    // In prezentare incarcam ONNX in browser. API-ul Gymnasium se conecteaza
    // doar cand apesi butonul cu mufa, ca slide-ul public sa nu depinda de localhost.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  async function resetArena() {
    if (!gymMode) {
      setLanes(createLanes());
      return;
    }

    try {
      setLanes(await Promise.all(taxiAgents.map((agent) => resetGymLane(agent))));
    } catch {
      setGymMode(false);
      setApiStatus("offline TS fallback");
      setLanes(createLanes());
    }
  }

  return (
    <div className={["taxi-arena", compact ? "taxi-arena--compact" : ""].join(" ")}>
      <div className="taxi-arena__bar">
        <div>
          <span className={`connection-dot connection-dot--${statusTone}`} />
          <span>{apiStatus}</span>
        </div>
        <label className="endpoint-control">
          <span>agent API</span>
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            aria-label="Agent API endpoint"
          />
        </label>
        <button className="icon-button" onClick={connectModels} title="Connect Gymnasium">
          {statusTone === "online" ? <Wifi size={18} /> : <Unplug size={18} />}
        </button>
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
            min="250"
            max="1200"
            step="50"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="taxi-grid-layout">
        {lanes.map((lane) => (
          <AgentLane key={lane.agent.id} lane={lane} requireGymnasium={compact} />
        ))}
      </div>
    </div>
  );
}

function AgentLane({
  lane,
  requireGymnasium,
}: {
  lane: LaneState;
  requireGymnasium: boolean;
}) {
  return (
    <article
      className="agent-lane"
      style={{ "--agent-accent": lane.agent.accent } as CSSProperties}
    >
      <div className="agent-lane__header">
        <div>
          <h3>{lane.agent.name}</h3>
          <p>{lane.agent.style}</p>
        </div>
        <span>{lane.reward}</span>
      </div>

      <TaxiVisualBoard lane={lane} />

      <dl className="agent-metrics">
        <div>
          <dt>obs</dt>
          <dd>{lane.observation}</dd>
        </div>
        <div>
          <dt>action</dt>
          <dd>{lane.lastAction}</dd>
        </div>
        <div>
          <dt>source</dt>
          <dd>{lane.source}</dd>
        </div>
      </dl>
      <p className="model-path">{lane.agent.modelHint}</p>
    </article>
  );
}

function hasRightWall(row: number, col: number) {
  return (col === 1 && (row === 0 || row === 1)) || (col === 0 && row >= 3) || (col === 2 && row >= 3);
}

function TaxiVisualBoard({ lane }: { lane: LaneState }) {
  return (
    <div className="taxi-visual" aria-label={`${lane.agent.name} Taxi-v3 environment`}>
      {Array.from({ length: 25 }).map((_, cellIndex) => {
        const row = Math.floor(cellIndex / 5);
        const col = cellIndex % 5;
        const landmarkIndex = taxiLandmarks.findIndex(
          (spot) => spot.row === row && spot.col === col,
        );
        const landmark = taxiLandmarks[landmarkIndex];
        const isTaxi = lane.taxi.taxiRow === row && lane.taxi.taxiCol === col;
        const passengerHere =
          lane.taxi.passenger !== 4 &&
          taxiLandmarks[lane.taxi.passenger].row === row &&
          taxiLandmarks[lane.taxi.passenger].col === col;
        const passengerInTaxi = isTaxi && lane.taxi.passenger === 4;
        const destinationHere =
          taxiLandmarks[lane.taxi.destination].row === row &&
          taxiLandmarks[lane.taxi.destination].col === col;

        return (
          <div
            className={[
              "taxi-visual__tile",
              landmark ? "taxi-visual__tile--landmark" : "",
              destinationHere ? "taxi-visual__tile--destination" : "",
              hasRightWall(row, col) ? "taxi-visual__tile--wall-right" : "",
            ].join(" ")}
            key={cellIndex}
          >
            {landmark && (
              <span className={`taxi-landmark taxi-landmark--${landmark.label.toLowerCase()}`}>
                {landmark.label}
              </span>
            )}
            {destinationHere && <span className="taxi-destination">DEST</span>}
            {passengerHere && <span className="taxi-passenger">P</span>}
            {isTaxi && (
              <span className="taxi-car">
                <span className="taxi-car__roof" />
                <span className="taxi-car__body">{passengerInTaxi ? "P" : ""}</span>
                <span className="taxi-car__wheel taxi-car__wheel--left" />
                <span className="taxi-car__wheel taxi-car__wheel--right" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
