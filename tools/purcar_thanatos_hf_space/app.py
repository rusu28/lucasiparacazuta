from __future__ import annotations

import os
import threading
import time
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


MODEL_ID = os.environ.get(
    "THANATOS_MODEL_ID",
    "ihatebaselines/purcar-thanatos-0.1",
)
HF_TOKEN = os.environ.get("HF_TOKEN")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class GenerateRequest(BaseModel):
    input: str = Field(min_length=1, max_length=50_000)
    temperature: float = Field(default=1.0, ge=0.01, le=1000)
    max_new_tokens: int = Field(default=48, ge=1, le=256)
    top_k: int = Field(default=50, ge=1, le=50_000)
    repetition_penalty: float = Field(default=1.15, ge=1.0, le=4.0)


app = FastAPI(title="PURCAR Thanatos 0.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_model: Any | None = None
_tokenizer: Any | None = None
_loaded_at: float | None = None
_load_lock = threading.Lock()


def load_runtime() -> tuple[Any, Any]:
    global _model, _tokenizer, _loaded_at
    if _model is not None and _tokenizer is not None:
        return _model, _tokenizer

    with _load_lock:
        if _model is not None and _tokenizer is not None:
            return _model, _tokenizer

        from transformers import AutoModelForCausalLM, AutoTokenizer

        started = time.time()
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, token=HF_TOKEN)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            token=HF_TOKEN,
            trust_remote_code=True,
        )
        if DEVICE.type == "cuda":
            model = model.to(device=DEVICE, dtype=torch.float16)
        else:
            model = model.to(DEVICE)
        model.eval()
        model.attach_tokenizer(tokenizer)

        _model = model
        _tokenizer = tokenizer
        _loaded_at = started
        return model, tokenizer


def format_prompt(value: str) -> str:
    prompt = value.strip()
    if "user:" in prompt.lower() and "assistant:" in prompt.lower():
        return prompt
    return f"User: {prompt}\nAssistant:"


def clean_reply(value: str) -> str:
    text = value.strip()
    assistant_index = text.lower().rfind("assistant:")
    if assistant_index >= 0:
        text = text[assistant_index + len("assistant:") :].strip()
    next_user = text.lower().find("\nuser:")
    if next_user >= 0:
        text = text[:next_user].strip()
    return text


@app.get("/")
def root() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "name": "PURCAR Thanatos 0.1",
        "description": "The newest model",
        "device": str(DEVICE),
        "loaded": _model is not None,
        "generate": "/generate",
    }


@app.get("/health")
def health() -> dict[str, str | bool | float | None]:
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": str(DEVICE),
        "loaded": _model is not None,
        "loaded_at": _loaded_at,
    }


@app.post("/generate")
def generate(request: GenerateRequest) -> dict[str, str]:
    try:
        model, tokenizer = load_runtime()
        output = model.generate(
            format_prompt(request.input),
            tokenizer=tokenizer,
            temperature=request.temperature,
            max_new_tokens=request.max_new_tokens,
            top_k=request.top_k,
            repetition_penalty=request.repetition_penalty,
        )
        return {"reply": clean_reply(str(output))}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc
