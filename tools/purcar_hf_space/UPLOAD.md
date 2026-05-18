# Upload PURCAR Chat API Space

Run these from PowerShell:

```powershell
hf repo create ihatebaselines/purcar-chat-api --type space --space-sdk docker
hf spaces secrets add ihatebaselines/purcar-chat-api -s HF_TOKEN
hf upload ihatebaselines/purcar-chat-api "D:\proiect_antreprenoriat\tools\purcar_hf_space" . --repo-type space
```

`HF_TOKEN` is stored as a Space secret. Do not put it in React or JavaScript files.

After the Space finishes building, the public endpoint is:

```text
https://ihatebaselines-purcar-chat-api.hf.space/generate
```

The React app already uses that URL by default. If you want to override it locally, put this in `.env.local`:

```env
VITE_PURCAR_CHAT_API_URL=https://ihatebaselines-purcar-chat-api.hf.space/generate
VITE_PURCAR_HF_MODEL_ID=ihatebaselines/purcar
```

Then rebuild/redeploy the site.
