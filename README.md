# ✍️ Descrierea problemei  
## Luca și Para Căzută 🍐

### Context
Pe un câmp însorit, Luca se plimba printre flori și copaci, admirând natura. Dintr-odată, o pară coaptă i-a căzut în cap! 😲  
Lovitura neașteptată i-a stârnit imaginația și i-a venit ideea genială: „Dacă aș înțelege matematica mai bine, aș putea calcula traiectoria fructelor și chiar să le prind fără să mă lovesc!”  

Astfel, Luca și-a propus să rezolve o serie de **probleme matematice variate**, ca să-și antreneze mintea și să devină rapid un expert în calcule. Tu trebuie să-l ajuți, rezolvând problemele din setul `test.csv`.

---

### 📁 Setul de date
Ai la dispoziție două fișiere:

- `train.csv` — probleme matematice deja rezolvate de Luca.  
- `test.csv` — probleme noi, pe care trebuie să le rezolvi.

#### train.csv
| Coloană     | Tip       | Descriere |
|------------|-----------|-----------|
| SampleID   | int       | ID unic al problemei |
| Problem    | object    | Problema matematică |
| Solution   | object    | Soluția corectă a problemei |

#### test.csv
| Coloană     | Tip       | Descriere |
|------------|-----------|-----------|
| SampleID   | int       | ID unic al problemei |
| Problem    | object    | Problema matematică de rezolvat |

#### groundtruth.csv
| Coloană     | Tip       | Descriere |
|------------|-----------|-----------|
| SampleID   | int       | ID-ul problemei |
| datapointID| int       | Întotdeauna 1 |
| answer     | object    | Soluția corectă pentru problema respectivă |

---

### 🧠 Task (100 puncte)
Trebuie să construiești un **sistem automat care rezolvă problemele din test.csv** și generează soluțiile corecte.

Problemele includ:

- Adunări, scăderi, înmulțiri și împărțiri (cu paranteze clare).  
- Ecuații liniare simple sau cu offset.  
- Ecuații cu pătrat perfect (ex. `x*x = 36`).  

---

### 🔹 Metrica de evaluare – „Math Accuracy Score (MAS)”

Evaluarea nu se bazează doar pe faptul că răspunsul este corect numeric, ci și pe **structura și claritatea soluției**, pentru a încuraja formatarea corectă și expresivă.

Fiecare soluție va fi evaluată cu formula:

\[
MAS = 0.6 \cdot NumericScore + 0.3 \cdot ParenthesesScore + 0.1 \cdot StepClarityScore
\]

unde:

1. **NumericScore (0–1)**  
   - 1 dacă rezultatul numeric este exact corect  
   - 0 dacă rezultatul este greșit  

2. **ParenthesesScore (0–1)**  
   - 1 dacă toate operațiile complexe sunt exprimate clar cu paranteze  
   - 0 dacă lipsesc parantezele necesare pentru claritate  

3. **StepClarityScore (0–1)**  
   - 1 dacă ecuațiile sau pașii de calcul sunt expliciți și ușor de citit (ex. `x = 12/3`, `The result of (3) + (-5) is -2`)  
   - 0 dacă soluția este ambiguă sau lipsesc pași importanți  

---

### 🔹 Exemplu de evaluare

Problema: `(3) + (-5)`  
- Răspuns corect numeric: `-2` → NumericScore = 1  
- Paranteze folosite corect → ParenthesesScore = 1  
- Soluție clară: `The result of (3) + (-5) is -2` → StepClarityScore = 1  

\[
MAS = 0.6*1 + 0.3*1 + 0.1*1 = 1.0 \quad \text{(100 puncte)}
\]

---

Problema: `3 + -5`  
- NumericScore = 1 (corect)  
- ParenthesesScore = 0 (paranteze lipsă)  
- StepClarityScore = 0 (nu e clar)  

\[
MAS = 0.6*1 + 0.3*0 + 0.1*0 = 0.6 \quad \text{(punctaj parțial)}
\]

---

### 📄 Formatul fișierului de submisie

Fișierul `submission.csv` trebuie să conțină un rând pentru fiecare problemă din test.csv:

| SampleID | datapointID | answer |
|----------|-------------|--------|
| 0        | 1           | x = 5 |
| 1        | 1           | The result of (3) + (-2) is 1 |

- `SampleID` — ID-ul problemei din test.csv  
- `datapointID` — întotdeauna 1  
- `answer` — soluția completă și clară  

---


Astfel, Luca va putea să învețe matematică, să calculeze traiectorii exacte, să scrie soluții clar exprimate și să fie pregătit pentru orice para care îi cade în cap! 🍐😭
