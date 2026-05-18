# ReformOne platform

Site React/Vite pentru doua suprafete:

- `/` - PURCAR, interfata de chat tip ChatGPT/Claude, cu sesiuni Supabase, conturi, settings si istoric doar pentru utilizatori logati.
- `/education/powerpoint` - prezentare interactiva ReformOne, Well,Edu!, TalIA, demo Taxi-v3 si mini-chat.

## Pornire frontend

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Supabase

Copiaza `.env.example` in `.env` si completeaza:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PURCAR_AGENT_API_URL=http://127.0.0.1:8027
```

Schema SQL este in `supabase/schema.sql`. Daca vezi mesajul ca lipsesc `support_threads` sau `chat_sessions`, ruleaza acel SQL in Supabase SQL Editor si reincarca aplicatia.

### Sesiuni si cont Elite

- Supabase Auth pastreaza sesiunea la reload si o refresh-uieste automat.
- Magic link si reset password folosesc `/auth/callback`.
- Dupa schimbarea parolei, utilizatorul este delogat si trebuie sa intre din nou.
- Pentru contul Elite demo foloseste:
  - `VITE_DEMO_ELITE_EMAIL=proiect+antre.elite@lowkai.xyz`
  - `VITE_DEMO_ELITE_USERNAME=TheOrangeJuice`
  - `VITE_DEMO_ELITE_PASSWORD=` doar in `.env.local`, niciodata in Git.

## Modele PyTorch pentru Taxi-v3

Pune modelele in `education/powerpoint/models`, apoi porneste API-ul:

```powershell
pip install -r tools\requirements.txt
uvicorn tools.purcar_agent_api:app --reload --port 8027
```

Frontend-ul poate verifica modelele prin butonul de conectare din slide-ul Taxi-v3.
