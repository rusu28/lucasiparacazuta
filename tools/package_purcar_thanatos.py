"""Package the Jelli checkpoint as PURCAR Thanatos 0.1 for Hugging Face.

Example:
  python tools/package_purcar_thanatos.py ^
    --checkpoint D:/angelua/jelli_best_1.pt ^
    --tokenizer-dir D:/angelua/taliabeta ^
    --out D:/angelua/purcar_thanatos_0_1_hf
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any, Mapping

import torch
from safetensors.torch import save_file


CONFIGURATION_CODE = r'''from transformers import PretrainedConfig


class ThanatosConfig(PretrainedConfig):
    model_type = "purcar_thanatos"

    def __init__(
        self,
        vocab_size=50000,
        max_len=1024,
        d_model=512,
        nhead=8,
        num_layers=48,
        dim_feedforward=2048,
        dropout=0.1,
        activation="gelu",
        pad_token_id=0,
        unk_token_id=1,
        bos_token_id=2,
        eos_token_id=3,
        **kwargs,
    ):
        super().__init__(
            pad_token_id=pad_token_id,
            bos_token_id=bos_token_id,
            eos_token_id=eos_token_id,
            **kwargs,
        )
        self.vocab_size = vocab_size
        self.max_len = max_len
        self.max_position_embeddings = max_len
        self.d_model = d_model
        self.hidden_size = d_model
        self.nhead = nhead
        self.num_attention_heads = nhead
        self.num_layers = num_layers
        self.num_hidden_layers = num_layers
        self.dim_feedforward = dim_feedforward
        self.intermediate_size = dim_feedforward
        self.dropout = dropout
        self.activation = activation
        self.unk_token_id = unk_token_id
'''


MODELING_CODE = r'''from __future__ import annotations

import math
from typing import Any

import torch
import torch.nn as nn
from transformers import PreTrainedModel
from transformers.modeling_outputs import CausalLMOutput

from .configuration_thanatos import ThanatosConfig


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int):
        super().__init__()
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model)
        )
        pe = torch.zeros(max_len, d_model)
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(1), :]


class ThanatosForCausalLM(PreTrainedModel):
    config_class = ThanatosConfig
    main_input_name = "input_ids"
    _tied_weights_keys: list[str] = []
    all_tied_weights_keys: dict[str, list[str]] = {}

    def __init__(self, config: ThanatosConfig):
        super().__init__(config)
        self.pos_enc = PositionalEncoding(config.d_model, config.max_len)
        self.emb = nn.Embedding(config.vocab_size, config.d_model)
        layer = nn.TransformerEncoderLayer(
            d_model=config.d_model,
            nhead=config.nhead,
            dim_feedforward=config.dim_feedforward,
            dropout=config.dropout,
            activation=config.activation,
            batch_first=True,
        )
        self.enc = nn.TransformerEncoder(layer, num_layers=config.num_layers)
        self.output = nn.Linear(config.d_model, config.vocab_size)
        self.d_model = config.d_model
        self.tokenizer = None

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
        labels: torch.Tensor | None = None,
        **_: Any,
    ) -> CausalLMOutput:
        padding_mask = input_ids.eq(self.config.pad_token_id)
        seq_len = input_ids.size(1)
        causal_mask = torch.triu(
            torch.ones(seq_len, seq_len, dtype=torch.bool, device=input_ids.device),
            diagonal=1,
        )

        x = self.emb(input_ids.long())
        x = self.pos_enc(x * math.sqrt(self.d_model))
        x = self.enc(x, mask=causal_mask, src_key_padding_mask=padding_mask)
        logits = self.output(x)

        loss = None
        if labels is not None:
            loss = nn.functional.cross_entropy(
                logits[:, :-1, :].contiguous().view(-1, logits.size(-1)),
                labels[:, 1:].contiguous().view(-1),
                ignore_index=self.config.pad_token_id,
            )

        return CausalLMOutput(loss=loss, logits=logits)

    def attach_tokenizer(self, tokenizer: Any) -> "ThanatosForCausalLM":
        self.tokenizer = tokenizer
        return self

    @torch.inference_mode()
    def generate(
        self,
        input_ids: str | torch.Tensor | None = None,
        temperature: float = 0.67,
        max_new_tokens: int = 220,
        tokenizer: Any | None = None,
        **_: Any,
    ) -> str | torch.Tensor:
        if isinstance(input_ids, torch.Tensor):
            return self._generate_ids(input_ids.to(self.device), temperature, max_new_tokens)

        active_tokenizer = tokenizer or self.tokenizer
        if active_tokenizer is None:
            raise ValueError("Pass tokenizer=... or call attach_tokenizer(tokenizer).")

        prompt = input_ids or ""
        encoded = active_tokenizer.encode(prompt)
        prompt_ids = encoded.ids if hasattr(encoded, "ids") else list(encoded)
        seed = torch.tensor(
            [[self.config.bos_token_id, *prompt_ids]],
            dtype=torch.long,
            device=self.device,
        )
        generated = self._generate_ids(seed, temperature, max_new_tokens)
        new_ids = generated[0, seed.size(1) :].tolist()
        return active_tokenizer.decode(
            [token for token in new_ids if token != self.config.eos_token_id],
            skip_special_tokens=True,
        )

    def _generate_ids(
        self,
        input_ids: torch.Tensor,
        temperature: float,
        max_new_tokens: int,
    ) -> torch.Tensor:
        self.eval()
        generated = input_ids.clone()
        temperature = max(float(temperature), 0.01)

        for _ in range(int(max_new_tokens)):
            context = generated[:, -self.config.max_len :]
            logits = self(context).logits[:, -1, :].float() / temperature
            probabilities = torch.softmax(logits, dim=-1)
            next_token = torch.multinomial(probabilities, 1)
            generated = torch.cat([generated, next_token], dim=1)
            if int(next_token[0, 0]) == self.config.eos_token_id:
                break

        return generated
'''


README_TEMPLATE = """---
library_name: transformers
pipeline_tag: text-generation
tags:
  - purcar
  - thanatos
  - custom-code
license: other
---

# PURCAR Thanatos 0.1

Thanatos 0.1 is a custom causal Transformer trained by the PURCAR project.

- 202,564,432 trainable parameters
- 48 Transformer encoder layers used causally
- hidden size 512
- 8 attention heads
- feed-forward size 2048
- ByteLevel BPE vocabulary of 50,000 tokens
- context window of 1,024 tokens

The original checkpoint was `{checkpoint_name}`. Optimizer and scheduler state
were intentionally excluded from `model.safetensors`.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

repo = "ihatebaselines/purcar-thanatos-0.1"
tokenizer = AutoTokenizer.from_pretrained(repo)
model = AutoModelForCausalLM.from_pretrained(repo, trust_remote_code=True)
model.attach_tokenizer(tokenizer)

reply = model.generate(
    "User: What are you?\\nAssistant:",
    temperature=0.67,
    max_new_tokens=80,
)
print(reply)
```
"""


def normalize_state_dict(raw: object) -> Mapping[str, torch.Tensor]:
    if not isinstance(raw, Mapping):
        raise TypeError(f"Unsupported checkpoint type: {type(raw)!r}")
    state = raw.get("model_state_dict", raw)
    if not isinstance(state, Mapping):
        raise TypeError("Checkpoint does not contain model_state_dict.")
    return {str(key): value.contiguous() for key, value in state.items() if isinstance(value, torch.Tensor)}


def infer_config(state: Mapping[str, torch.Tensor]) -> dict[str, Any]:
    layer_ids = {
        int(match.group(1))
        for key in state
        if (match := re.search(r"enc\.layers\.(\d+)\.", key))
    }
    embedding = state["emb.weight"]
    return {
        "architectures": ["ThanatosForCausalLM"],
        "auto_map": {
            "AutoConfig": "configuration_thanatos.ThanatosConfig",
            "AutoModelForCausalLM": "modeling_thanatos.ThanatosForCausalLM",
        },
        "model_type": "purcar_thanatos",
        "torch_dtype": "float32",
        "vocab_size": int(embedding.shape[0]),
        "max_len": int(state["pos_enc.pe"].shape[1]),
        "max_position_embeddings": int(state["pos_enc.pe"].shape[1]),
        "d_model": int(embedding.shape[1]),
        "hidden_size": int(embedding.shape[1]),
        "nhead": 8,
        "num_attention_heads": 8,
        "num_layers": len(layer_ids),
        "num_hidden_layers": len(layer_ids),
        "dim_feedforward": int(state["enc.layers.0.linear1.weight"].shape[0]),
        "intermediate_size": int(state["enc.layers.0.linear1.weight"].shape[0]),
        "dropout": 0.1,
        "activation": "gelu",
        "pad_token_id": 0,
        "unk_token_id": 1,
        "bos_token_id": 2,
        "eos_token_id": 3,
    }


def write_json(path: Path, value: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--tokenizer-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    raw = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    state = normalize_state_dict(raw)
    config = infer_config(state)

    save_file(state, args.out / "model.safetensors")
    shutil.copyfile(args.tokenizer_dir / "vocab.json", args.out / "vocab.json")
    shutil.copyfile(args.tokenizer_dir / "merges.txt", args.out / "merges.txt")

    write_json(args.out / "config.json", config)
    write_json(
        args.out / "tokenizer_config.json",
        {
            "tokenizer_class": "GPT2TokenizerFast",
            "model_max_length": config["max_len"],
            "bos_token": "<bos>",
            "eos_token": "<eos>",
            "unk_token": "<unk>",
            "pad_token": "<pad>",
        },
    )
    write_json(
        args.out / "special_tokens_map.json",
        {
            "bos_token": "<bos>",
            "eos_token": "<eos>",
            "unk_token": "<unk>",
            "pad_token": "<pad>",
        },
    )
    write_json(
        args.out / "generation_config.json",
        {
            "bos_token_id": 2,
            "eos_token_id": 3,
            "pad_token_id": 0,
            "do_sample": True,
            "temperature": 0.67,
            "max_new_tokens": 220,
        },
    )
    (args.out / "configuration_thanatos.py").write_text(CONFIGURATION_CODE, encoding="utf-8")
    (args.out / "modeling_thanatos.py").write_text(MODELING_CODE, encoding="utf-8")
    (args.out / "README.md").write_text(
        README_TEMPLATE.format(checkpoint_name=args.checkpoint.name),
        encoding="utf-8",
    )

    print(f"Packaged Thanatos 0.1 in {args.out}")
    print(f'hf upload ihatebaselines/purcar-thanatos-0.1 "{args.out}" . --repo-type model')


if __name__ == "__main__":
    main()
