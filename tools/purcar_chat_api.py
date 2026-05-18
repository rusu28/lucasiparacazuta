from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


MODEL_PATH = Path(os.environ.get("PURCAR_CHAT_MODEL_PATH", r"D:\AI\Q&A\purcar_hf_best_model5"))
HF_TOKEN = os.environ.get("HF_TOKEN")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class GenerateRequest(BaseModel):
    input: str = Field(min_length=1, max_length=8000)
    temperature: float = Field(default=0.15, ge=0.01, le=1000)
    max_new_tokens: int = Field(default=220, ge=1, le=2048)


app = FastAPI(title="PURCAR Chat Model API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_loaded_model: Any | None = None
_loaded_tokenizer: Any | None = None


def load_model_and_tokenizer() -> tuple[Any, Any | None]:
    global _loaded_model, _loaded_tokenizer
    if _loaded_model is not None:
        return _loaded_model, _loaded_tokenizer

    if not MODEL_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Model not found: {MODEL_PATH}")

    if MODEL_PATH.is_dir():
        try:
            from transformers import AutoModelForCausalLM, GPT2TokenizerFast
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Install transformers to load the HF package: {exc}",
            ) from exc

        tokenizer = GPT2TokenizerFast.from_pretrained(str(MODEL_PATH), token=HF_TOKEN)
        model = AutoModelForCausalLM.from_pretrained(str(MODEL_PATH), trust_remote_code=True, token=HF_TOKEN)
        model.to(DEVICE)
        model.eval()
        if hasattr(model, "attach_tokenizer"):
            model.attach_tokenizer(tokenizer)
        _loaded_model = model
        _loaded_tokenizer = tokenizer
        return model, tokenizer

    try:
        model = torch.jit.load(str(MODEL_PATH), map_location=DEVICE)
    except Exception:
        payload = torch.load(MODEL_PATH, map_location=DEVICE)
        model = payload.get("model", payload) if isinstance(payload, dict) else payload

    if hasattr(model, "to"):
        model = model.to(DEVICE)
    if hasattr(model, "eval"):
        model.eval()

    _loaded_model = model
    return model, None


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "device": str(DEVICE), "model_path": str(MODEL_PATH)}


@app.post("/generate")
def generate(request: GenerateRequest) -> dict[str, str]:
    model, tokenizer = load_model_and_tokenizer()
    if not hasattr(model, "generate"):
        raise HTTPException(
            status_code=422,
            detail="Loaded checkpoint has no generate method. Use the HF package folder created by package_purcar_hf_model.py.",
        )

    with torch.no_grad():
        output = model.generate(
            format_chat_prompt(request.input),
            tokenizer=tokenizer,
            temperature=request.temperature,
            max_len=request.max_new_tokens,
        )

    return {"reply": extract_assistant_text(stringify_output(output))}
