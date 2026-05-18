from __future__ import annotations

import os
import time
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


MODEL_ID = os.environ.get("PURCAR_MODEL_ID", "ihatebaselines/purcar")
HF_TOKEN = os.environ.get("HF_TOKEN")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class GenerateRequest(BaseModel):
    input: str = Field(min_length=1, max_length=8000)
    temperature: float = Field(default=0.15, ge=0.01, le=1000)
    max_new_tokens: int = Field(default=220, ge=1, le=2048)


app = FastAPI(title="PURCAR Chat API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_loaded_model: Any | None = None
_loaded_tokenizer: Any | None = None
_loaded_at: float | None = None


def load_model_and_tokenizer() -> tuple[Any, Any]:
    global _loaded_model, _loaded_tokenizer, _loaded_at
    if _loaded_model is not None and _loaded_tokenizer is not None:
        return _loaded_model, _loaded_tokenizer

    try:
        from transformers import AutoModelForCausalLM, GPT2TokenizerFast
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Missing model dependencies: {exc}") from exc

    started = time.time()
    tokenizer = GPT2TokenizerFast.from_pretrained(MODEL_ID, token=HF_TOKEN)
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID, trust_remote_code=True, token=HF_TOKEN)
    model.to(DEVICE)
    model.eval()
    if hasattr(model, "attach_tokenizer"):
        model.attach_tokenizer(tokenizer)

    _loaded_model = model
    _loaded_tokenizer = tokenizer
    _loaded_at = started
    return model, tokenizer


def stringify_output(output: Any) -> str:
    if isinstance(output, str):
        return output
    if isinstance(output, bytes):
        return output.decode("utf-8", errors="replace")
    if isinstance(output, (list, tuple)) and output:
        return stringify_output(output[0])
    return str(output)


def format_chat_prompt(user_input: str) -> str:
    text = user_input.strip()
    if "user:" in text.lower() and "assistant:" in text.lower():
        return text
    return f"User: {text}\nAssistant:"


def extract_assistant_text(text: str) -> str:
    cleaned = text.strip()
    lower = cleaned.lower()
    marker = "assistant:"
    index = lower.rfind(marker)
    if index >= 0:
        cleaned = cleaned[index + len(marker) :].strip()

    next_user = cleaned.lower().find("\nuser:")
    if next_user >= 0:
        cleaned = cleaned[:next_user].strip()

    return cleaned


@app.get("/")
def root() -> dict[str, str]:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": str(DEVICE),
        "has_token": str(bool(HF_TOKEN)),
        "generate": "/generate",
    }


@app.get("/health")
def health() -> dict[str, str | bool | float | None]:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": str(DEVICE),
        "has_token": bool(HF_TOKEN),
        "loaded": _loaded_model is not None,
        "loaded_at": _loaded_at,
    }


@app.post("/generate")
def generate(request: GenerateRequest) -> dict[str, str]:
    model, tokenizer = load_model_and_tokenizer()

    try:
        with torch.no_grad():
            output = model.generate(
                format_chat_prompt(request.input),
                tokenizer=tokenizer,
                temperature=request.temperature,
                max_len=request.max_new_tokens,
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    return {"reply": extract_assistant_text(stringify_output(output))}
