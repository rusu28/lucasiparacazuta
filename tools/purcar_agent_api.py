from __future__ import annotations

from pathlib import Path
import os
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import gymnasium as gym
except Exception:  # pragma: no cover - optional at import time
    gym = None


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "education" / "powerpoint" / "models"
EXTERNAL_MODEL_DIR = Path(
    os.environ.get("PURCAR_RL_MODEL_DIR", r"D:\ReinforcementLearning\ProiectAntreprenoriala")
)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class ActRequest(BaseModel):
    observation: int = Field(ge=0, le=499)


class TaxiSessionRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=80)


class TaxiStepRequest(TaxiSessionRequest):
    action: int = Field(ge=0, le=5)


class DqnPolicy(torch.nn.Module):
    def __init__(self, input_size: int = 500, hidden_size: int = 128, actions: int = 6):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(input_size, hidden_size),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden_size, hidden_size),
            torch.nn.ReLU(),
            torch.nn.Linear(hidden_size, actions),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class EmbeddingActorPolicy(torch.nn.Module):
    uses_discrete_observation = True

    def __init__(self, actions: int = 6):
        super().__init__()
        self.output = torch.nn.Sequential(
            torch.nn.Embedding(500, 64),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
        )
        self.actor = torch.nn.Linear(64, actions)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.actor(self.output(x.long()))


class EmbeddingActorCriticPolicy(torch.nn.Module):
    uses_discrete_observation = True

    def __init__(self, actions: int = 6):
        super().__init__()
        self.output = torch.nn.Sequential(
            torch.nn.Embedding(500, 64),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
        )
        self.actor = torch.nn.Linear(64, actions)
        self.critic = torch.nn.Linear(64, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        encoded = self.output(x.long())
        return self.actor(encoded)


class EmbeddingPolicy(torch.nn.Module):
    uses_discrete_observation = True

    def __init__(self, actions: int = 6):
        super().__init__()
        self.output = torch.nn.Sequential(
            torch.nn.Embedding(500, 64),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, 64),
            torch.nn.GELU(),
            torch.nn.Linear(64, actions),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.output(x.long())


def one_hot_observation(observation: int) -> torch.Tensor:
    tensor = torch.zeros((1, 500), dtype=torch.float32, device=DEVICE)
    tensor[0, observation] = 1.0
    return tensor


def model_files() -> list[Path]:
    folders = [MODEL_DIR, EXTERNAL_MODEL_DIR]
    files: list[Path] = []
    for folder in folders:
        if not folder.exists():
            continue
        files.extend(
            path
            for path in folder.iterdir()
            if path.suffix.lower() in {".pt", ".pth", ".torchscript"}
        )
    return sorted(files)


def load_model(path: Path) -> torch.nn.Module:
    try:
        model = torch.jit.load(str(path), map_location=DEVICE)
        model.eval()
        return model
    except Exception:
        payload: Any = torch.load(path, map_location=DEVICE)

    if isinstance(payload, torch.nn.Module):
        payload.to(DEVICE)
        payload.eval()
        return payload

    state_dict = payload.get("state_dict", payload) if isinstance(payload, dict) else payload
    hidden_size = 128
    if isinstance(payload, dict):
        hidden_size = int(payload.get("hidden_size", hidden_size))

    if isinstance(state_dict, dict) and "critic.weight" in state_dict and "output.0.weight" in state_dict:
        model = EmbeddingActorCriticPolicy().to(DEVICE)
        model.load_state_dict(state_dict)
        model.eval()
        return model

    if isinstance(state_dict, dict) and "actor.weight" in state_dict and "output.0.weight" in state_dict:
        model = EmbeddingActorPolicy().to(DEVICE)
        model.load_state_dict(state_dict)
        model.eval()
        return model

    if isinstance(state_dict, dict) and "output.7.weight" in state_dict and "output.0.weight" in state_dict:
        model = EmbeddingPolicy().to(DEVICE)
        model.load_state_dict(state_dict)
        model.eval()
        return model

    model = DqnPolicy(hidden_size=hidden_size).to(DEVICE)
    model.load_state_dict(state_dict)
    model.eval()
    return model


def loaded_agents() -> dict[str, torch.nn.Module]:
    agents: dict[str, torch.nn.Module] = {}
    for path in model_files():
        try:
            agents[path.stem] = load_model(path)
        except Exception as exc:
            print(f"Could not load {path.name}: {exc}")
    return agents


app = FastAPI(title="PURCAR Taxi-v3 Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

taxi_envs: dict[str, Any] = {}


def decode_taxi_observation(observation: int) -> dict[str, int]:
    destination = observation % 4
    observation //= 4
    passenger = observation % 5
    observation //= 5
    taxi_col = observation % 5
    taxi_row = observation // 5
    return {
        "taxi_row": int(taxi_row),
        "taxi_col": int(taxi_col),
        "passenger": int(passenger),
        "destination": int(destination),
    }


def gymnasium_unavailable() -> None:
    if gym is None:
        raise HTTPException(status_code=503, detail="gymnasium is not installed")


def make_taxi_env() -> Any:
    gymnasium_unavailable()
    return gym.make("Taxi-v3", render_mode="ansi")


def render_env(env: Any) -> str:
    rendered = env.render()
    return rendered if isinstance(rendered, str) else ""


def reset_taxi_session(session_id: str) -> dict[str, Any]:
    old_env = taxi_envs.pop(session_id, None)
    if old_env is not None:
        old_env.close()

    env = make_taxi_env()
    observation, _ = env.reset()
    taxi_envs[session_id] = env
    observation = int(observation)
    return {
        "session_id": session_id,
        "observation": observation,
        "decoded_state": decode_taxi_observation(observation),
        "render_text": render_env(env),
        "reward": 0,
        "terminated": False,
        "truncated": False,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "device": str(DEVICE)}


@app.get("/agents")
def agents() -> dict[str, list[dict[str, str]]]:
    return {
        "agents": [
            {"id": path.stem, "file": str(path)}
            for path in model_files()
        ]
    }


@app.post("/agents/{agent_id}/act")
def act(agent_id: str, request: ActRequest) -> dict[str, int | list[float]]:
    agents_by_id = loaded_agents()
    model = agents_by_id.get(agent_id)
    if model is None:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")

    with torch.no_grad():
        if getattr(model, "uses_discrete_observation", False):
            model_input = torch.tensor([request.observation], dtype=torch.long, device=DEVICE)
        else:
            model_input = one_hot_observation(request.observation)
        q_values = model(model_input)
        if isinstance(q_values, tuple):
            q_values = q_values[0]
        q_values = q_values.detach().cpu().reshape(-1)
        action = int(torch.argmax(q_values).item())

    return {"action": action, "q_values": [float(value) for value in q_values.tolist()]}


@app.get("/taxi-v3/reset")
def taxi_reset() -> dict[str, int]:
    gymnasium_unavailable()
    env = gym.make("Taxi-v3")
    observation, _ = env.reset()
    env.close()
    return {"observation": int(observation)}


@app.post("/taxi-v3/session/reset")
def taxi_session_reset(request: TaxiSessionRequest) -> dict[str, Any]:
    return reset_taxi_session(request.session_id)


@app.post("/taxi-v3/session/step")
def taxi_session_step(request: TaxiStepRequest) -> dict[str, Any]:
    env = taxi_envs.get(request.session_id)
    if env is None:
        reset_taxi_session(request.session_id)
        env = taxi_envs[request.session_id]

    observation, reward, terminated, truncated, _ = env.step(request.action)
    observation = int(observation)
    return {
        "session_id": request.session_id,
        "observation": observation,
        "decoded_state": decode_taxi_observation(observation),
        "render_text": render_env(env),
        "reward": int(reward),
        "terminated": bool(terminated),
        "truncated": bool(truncated),
    }
