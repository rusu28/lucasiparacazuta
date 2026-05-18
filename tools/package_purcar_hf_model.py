"""Build a Hugging Face-ready PURCAR/TalIA checkpoint folder.

Usage:
  uv run --with torch --with safetensors tools/package_purcar_hf_model.py `
    --checkpoint "D:/AI/Q&A/best_model5.pt" `
    --tokenizer-dir "D:/AI/Q&A/taliabeta" `
    --out "D:/AI/Q&A/purcar_hf_best_model5"

Then upload:
  hf upload ihatebaselines/purcar "D:/AI/Q&A/purcar_hf_best_model5" . --repo-type model
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


class TaliaBetaConfig(PretrainedConfig):
    model_type = "talia_beta_plm"

    def __init__(
        self,
        vocab_size=50000,
        max_len=512,
        d_model=256,
        nhead=4,
        num_layers=6,
        dim_feedforward=4096,
        dropout=0.1,
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
        self.d_model = d_model
        self.nhead = nhead
        self.num_layers = num_layers
        self.dim_feedforward = dim_feedforward
        self.dropout = dropout
        self.unk_token_id = unk_token_id
'''


MODELING_CODE = r'''from __future__ import annotations

import math
from typing import Any

import torch
import torch.nn as nn
from transformers import PreTrainedModel
from transformers.modeling_outputs import CausalLMOutput

from .configuration_talia_beta import TaliaBetaConfig


class PositionalEncoding(nn.Module):
    def __init__(self, max_len: int, d_model: int):
        super().__init__()
        position = torch.arange(max_len).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2) * (-math.log(10000.0) / d_model))
        pe = torch.zeros(1, max_len, d_model)
        pe[0, :, 0::2] = torch.sin(position * div_term)
        pe[0, :, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(1)]


class ResidualBlock(nn.Module):
    def __init__(self, input_dim: int = 8096, hidden_dim: int = 16192):
        super().__init__()
        self.fc1 = nn.Sequential(nn.Linear(input_dim, hidden_dim))
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.shortcut = nn.Linear(input_dim, hidden_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.fc2(self.fc1(x)) + self.shortcut(x)


class TaliaBetaForCausalLM(PreTrainedModel):
    config_class = TaliaBetaConfig
    main_input_name = "input_ids"
    supports_gradient_checkpointing = False
    _tied_weights_keys: list[str] = []
    all_tied_weights_keys: dict[str, list[str]] = {}

    def __init__(self, config: TaliaBetaConfig):
        super().__init__(config)
        self.emb = nn.Embedding(config.vocab_size, config.d_model)
        self.pe = PositionalEncoding(config.max_len, config.d_model)
        encoder_layer = nn.TransformerEncoderLayer(
            config.d_model,
            config.nhead,
            config.dim_feedforward,
            config.dropout,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=config.num_layers)
        self.output = nn.Sequential(nn.Linear(config.d_model, config.vocab_size))
        self.d_model = config.d_model
        self.res = ResidualBlock(8096, 8096 * 2)
        self.final_output = nn.Linear(8096 * 2, config.vocab_size)
        self.tokenizer = None

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
        labels: torch.Tensor | None = None,
        **_: Any,
    ) -> CausalLMOutput:
        device = input_ids.device
        padding_mask = input_ids.eq(self.config.pad_token_id)
        causal_mask = nn.Transformer.generate_square_subsequent_mask(input_ids.size(1)).to(device)

        x = self.emb(input_ids.long()) * math.sqrt(self.d_model)
        x = self.pe(x)
        x = self.transformer(x, mask=causal_mask, src_key_padding_mask=padding_mask)
        logits = self.output(x)

        loss = None
        if labels is not None:
            loss = nn.functional.cross_entropy(
                logits[:, :-1, :].contiguous().view(-1, logits.size(-1)),
                labels[:, 1:].contiguous().view(-1),
                ignore_index=self.config.pad_token_id,
            )

        return CausalLMOutput(loss=loss, logits=logits)

    def attach_tokenizer(self, tokenizer: Any) -> "TaliaBetaForCausalLM":
        self.tokenizer = tokenizer
        return self

    @torch.no_grad()
    def generate(
        self,
        input_ids: str | torch.Tensor | None = None,
        temperature: float = 0.15,
        max_len: int = 512,
        max_new_tokens: int | None = None,
        tokenizer: Any | None = None,
        **_: Any,
    ) -> str | torch.Tensor:
        active_tokenizer = tokenizer or self.tokenizer

        if isinstance(input_ids, torch.Tensor):
            return self._generate_ids(input_ids.to(self.device), temperature, max_new_tokens or max_len)

        if active_tokenizer is None:
            raise ValueError("Pass tokenizer=... or call model.attach_tokenizer(tokenizer) before generate(str).")

        start_text = input_ids or ""
        encoded = active_tokenizer.encode(start_text)
        ids = encoded.ids if hasattr(encoded, "ids") else list(encoded)
        seed = torch.tensor(
            [self.config.bos_token_id, *ids],
            dtype=torch.long,
            device=self.device,
        ).unsqueeze(0)
        generated_ids = self._generate_ids(seed, temperature, max_new_tokens or max_len)[0].tolist()
        only_new = generated_ids[len(seed[0]) :]
        return active_tokenizer.decode([token for token in only_new if token != self.config.eos_token_id])

    def _generate_ids(self, input_ids: torch.Tensor, temperature: float, max_new_tokens: int) -> torch.Tensor:
        self.eval()
        text = input_ids[:, -256:].clone()
        generated = text
        temperature = max(float(temperature), 1e-6)

        for _ in range(max_new_tokens):
            logits = self(text).logits[:, -1, :] / temperature
            values, indices = torch.topk(logits, 50, dim=-1)
            probs = torch.softmax(values, dim=-1)
            sampled = indices.gather(-1, torch.multinomial(probs, 1))
            generated = torch.cat([generated, sampled], dim=1)
            if int(sampled[0, 0].item()) == self.config.eos_token_id:
                break
            text = generated[:, -256:]

        return generated
'''


README_TEMPLATE = """# PURCAR / TalIA Beta PLM

Custom PyTorch Transformer checkpoint packaged for Hugging Face.

Files:
- `model.safetensors`: converted from `{checkpoint_name}`
- `vocab.json`, `merges.txt`: ByteLevel BPE tokenizer files
- `modeling_talia_beta.py`, `configuration_talia_beta.py`: custom model code with `generate(...)`

Local load:

```python
from transformers import AutoModelForCausalLM, GPT2TokenizerFast

repo = "ihatebaselines/purcar"
tokenizer = GPT2TokenizerFast.from_pretrained(repo)
model = AutoModelForCausalLM.from_pretrained(repo, trust_remote_code=True)
model.attach_tokenizer(tokenizer)
print(model.generate("User: bro say Purcar\\nAssistant:", temperature=0.15, max_len=120))
```
"""


def normalize_state_dict(raw: object) -> Mapping[str, torch.Tensor]:
    if isinstance(raw, torch.nn.Module):
        return raw.state_dict()
    if not isinstance(raw, Mapping):
        raise TypeError(f"Unsupported checkpoint type: {type(raw)!r}")

    for key in ("model_state_dict", "state_dict", "model"):
        value = raw.get(key)
        if isinstance(value, Mapping):
            raw = value
            break

    return {str(key).removeprefix("plm."): value for key, value in raw.items() if isinstance(value, torch.Tensor)}


def infer_config(state_dict: Mapping[str, torch.Tensor]) -> dict[str, Any]:
    layer_ids = sorted(
        {
            int(match.group(1))
            for key in state_dict
            if (match := re.search(r"transformer\.layers\.(\d+)\.", key))
        }
    )
    emb_weight = state_dict["emb.weight"]
    return {
        "architectures": ["TaliaBetaForCausalLM"],
        "auto_map": {
            "AutoConfig": "configuration_talia_beta.TaliaBetaConfig",
            "AutoModelForCausalLM": "modeling_talia_beta.TaliaBetaForCausalLM",
        },
        "model_type": "talia_beta_plm",
        "torch_dtype": "float32",
        "vocab_size": int(emb_weight.shape[0]),
        "max_len": int(state_dict["pe.pe"].shape[1]),
        "d_model": int(emb_weight.shape[1]),
        "nhead": 4,
        "num_layers": len(layer_ids),
        "dim_feedforward": int(state_dict["transformer.layers.0.linear1.weight"].shape[0]),
        "dropout": 0.1,
        "pad_token_id": 0,
        "unk_token_id": 1,
        "bos_token_id": 2,
        "eos_token_id": 3,
    }


def write_json(path: Path, data: Mapping[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--tokenizer-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    raw = torch.load(args.checkpoint, map_location="cpu")
    state_dict = normalize_state_dict(raw)
    config = infer_config(state_dict)

    save_file(state_dict, args.out / "model.safetensors")
    shutil.copyfile(args.tokenizer_dir / "vocab.json", args.out / "vocab.json")
    shutil.copyfile(args.tokenizer_dir / "merges.txt", args.out / "merges.txt")

    write_json(args.out / "config.json", config)
    write_json(
        args.out / "tokenizer_config.json",
        {
            "tokenizer_class": "GPT2TokenizerFast",
            "bos_token": "<bos>",
            "eos_token": "<eos>",
            "unk_token": "<unk>",
            "pad_token": "<pad>",
            "model_max_length": 512,
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
            "temperature": 0.15,
            "max_new_tokens": 220,
            "do_sample": True,
        },
    )
    (args.out / "configuration_talia_beta.py").write_text(CONFIGURATION_CODE, encoding="utf-8")
    (args.out / "modeling_talia_beta.py").write_text(MODELING_CODE, encoding="utf-8")
    (args.out / "README.md").write_text(
        README_TEMPLATE.format(checkpoint_name=args.checkpoint.name),
        encoding="utf-8",
    )

    print(f"Packaged PURCAR HF model in: {args.out}")
    print(f"Upload command:")
    print(f"hf upload ihatebaselines/purcar \"{args.out}\" . --repo-type model")


if __name__ == "__main__":
    main()
