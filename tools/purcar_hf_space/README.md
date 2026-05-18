---
title: PURCAR Chat API
emoji: 🧠
colorFrom: gray
colorTo: blue
sdk: docker
pinned: false
license: mit
---

# PURCAR Chat API

FastAPI wrapper for `ihatebaselines/purcar`.

If the model repo is private, set `HF_TOKEN` as a Space secret.

Public endpoint after upload:

```text
https://ihatebaselines-purcar-chat-api.hf.space/generate
```

Request:

```json
{
  "input": "User: say Purcar\nAssistant:",
  "temperature": 0.15,
  "max_new_tokens": 220
}
```

Response:

```json
{
  "reply": "Purcar"
}
```
