# CartPole-v1 ONNX agents

Modelele active incarcate de frontend sunt variantele `float32`, cu nume
versionate ca sa nu fie confundate cu modele vechi din cache:

- `cartpole_expected_sarsa_float32.onnx`
- `cartpole_reinforce_float32.onnx`
- `cartpole_actor_critic_float32.onnx`

Fisierele vechi pot ramane in folder doar ca backup, dar componenta nu le mai
incarca.

Checkpoint-urile curente vin din `D:/ReinforcementLearning/ProiectAntreprenoriala`:

- `expected_sarsa_best_cool.pth`
- `mountain_car_reinforce.pth`
- `actor_critic_mountain.pth`

Export:

```powershell
uv run --with torch --with onnx tools/export_taxi_models_to_onnx.py `
  --source D:/ReinforcementLearning/ProiectAntreprenoriala `
  --out public/education/powerpoint/models
```

Frontend-ul le incarca doar cand ruleaza componenta `CartPoleArena`. Exportul
foloseste `external_data=False`, deci fiecare model ramane intr-un singur fisier
`.onnx`. Fiecare model primeste un tensor `observation` cu shape `[1, 4]`:
`[cart_position, cart_velocity, pole_angle, pole_angular_velocity]`.

Output-ul are doua valori pentru actiunile CartPole-v1:

- `0` = push left
- `1` = push right

Daca fisierele `.onnx` lipsesc sau browserul nu le poate incarca, demo-ul ramane
activ pe fallback-ul TypeScript.
