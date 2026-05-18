"""Export the three CartPole-v1 PyTorch demo agents to browser-friendly ONNX.

Usage:
  uv run --with torch --with onnx tools/export_taxi_models_to_onnx.py \
    --source D:/ReinforcementLearning/ProiectAntreprenoriala \
    --out public/education/powerpoint/models

The exported ONNX models receive one CartPole-v1 observation as float32 tensor
named `observation` with shape [1, 4], then return two action logits/q-values.
The frontend ranks output[0] and output[1], chooses an action, and steps the
local CartPole-v1 environment.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from typing import Mapping, NamedTuple

import torch
import torch.nn as nn


class ExpectedSarsaPolicy(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.output = nn.Sequential(
            nn.Linear(4, 64),
            nn.GELU(),
            nn.Linear(64, 64),
            nn.GELU(),
            nn.Linear(64, 64),
            nn.GELU(),
        )
        self.actor = nn.Linear(64, 2)

    def forward(self, observation: torch.Tensor) -> torch.Tensor:
        x = self.output(observation.float())
        return self.actor(x)


class ReinforcePolicy(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.output = nn.Sequential(
            nn.Linear(4, 64),
            nn.GELU(),
            nn.Linear(64, 64),
            nn.GELU(),
            nn.Linear(64, 64),
            nn.GELU(),
            nn.Linear(64, 2),
        )

    def forward(self, observation: torch.Tensor) -> torch.Tensor:
        return self.output(observation.float())


class ActorCriticPolicy(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.output = nn.Sequential(
            nn.Linear(4, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
        )
        self.actor = nn.Linear(32, 2)
        self.critic = nn.Linear(32, 1)

    def forward(self, observation: torch.Tensor) -> torch.Tensor:
        x = self.output(observation.float())
        return self.actor(x)


class ModelSpec(NamedTuple):
    checkpoint_name: str
    model_cls: type[nn.Module]
    output_names: tuple[str, ...]


MODEL_SPECS: Mapping[str, ModelSpec] = {
    "expected_sarsa": ModelSpec(
        "expected_sarsa_best_cool.pth",
        ExpectedSarsaPolicy,
        ("expected_sarsa.onnx", "cartpole_expected_sarsa_float32.onnx"),
    ),
    "mountain_car_reinforce": ModelSpec(
        "mountain_car_reinforce.pth",
        ReinforcePolicy,
        ("mountain_car_reinforce.onnx", "cartpole_reinforce_float32.onnx"),
    ),
    "actor_critic_mountain": ModelSpec(
        "actor_critic_mountain.pth",
        ActorCriticPolicy,
        ("actor_critic_mountain.onnx", "cartpole_actor_critic_float32.onnx"),
    ),
}


def normalize_state_dict(raw: object) -> Mapping[str, torch.Tensor]:
    if isinstance(raw, nn.Module):
        return raw.state_dict()
    if not isinstance(raw, Mapping):
        raise TypeError(f"Unsupported checkpoint type: {type(raw)!r}")

    for key in ("model_state_dict", "state_dict", "model"):
        value = raw.get(key)
        if isinstance(value, Mapping):
            raw = value
            break

    return {
        str(key).removeprefix("model."): value
        for key, value in raw.items()
        if isinstance(value, torch.Tensor)
    }


def export_model(source: Path, out_dir: Path, model_id: str, spec: ModelSpec) -> None:
    checkpoint_path = source / spec.checkpoint_name
    if not checkpoint_path.exists():
        raise FileNotFoundError(checkpoint_path)

    model = spec.model_cls()
    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    model.load_state_dict(normalize_state_dict(checkpoint), strict=True)
    model.eval()

    out_path = out_dir / spec.output_names[0]
    dummy_observation = torch.zeros((1, 4), dtype=torch.float32)
    torch.onnx.export(
        model,
        dummy_observation,
        out_path,
        input_names=["observation"],
        output_names=["action_values"],
        export_params=True,
        external_data=False,
        opset_version=18,
    )
    print(f"exported {checkpoint_path} -> {out_path}")

    for alias in spec.output_names[1:]:
        alias_path = out_dir / alias
        shutil.copyfile(out_path, alias_path)
        print(f"copied {out_path} -> {alias_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    for model_id, spec in MODEL_SPECS.items():
        export_model(args.source, args.out, model_id, spec)


if __name__ == "__main__":
    main()
