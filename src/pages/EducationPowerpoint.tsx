import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, FocusEvent, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Cpu,
  Database,
  FileText,
  GraduationCap,
  Megaphone,
  Network,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import { MiniPurcarWidget } from "../components/MiniPurcarWidget";
import { CartPoleArena } from "../components/CartPoleArena";
import { isHardcodedAdminEmail } from "../lib/adminAccess";
import { supabase } from "../lib/supabase";

const orbitDots = Array.from({ length: 132 }, (_, index) => index);

const slideMeta = [
  { id: "intro", chapter: "ReformOne" },
  { id: "market", chapter: "Oportunitate" },
  { id: "misiune", chapter: "ReformOne" },
  { id: "problema", chapter: "Well,Edu!" },
  { id: "solutie", chapter: "Well,Edu!" },
  { id: "bac-gratuit", chapter: "Well,Edu!" },
  { id: "agent-ai", chapter: "Well,Edu!" },
  { id: "competitii", chapter: "Well,Edu!" },
  { id: "rl-capitol", chapter: "Well,Edu!" },
  { id: "premium", chapter: "Business" },
  { id: "abonamente", chapter: "Business" },
  { id: "costuri", chapter: "Business" },
  { id: "venituri", chapter: "Business" },
  { id: "resurse", chapter: "Business" },
  { id: "caen", chapter: "Business" },
  { id: "marketing", chapter: "Marketing" },
  { id: "promovare", chapter: "Marketing" },
  { id: "talia", chapter: "TalIA" },
  { id: "intrebare", chapter: "AI central" },
  { id: "purcar", chapter: "PURCAR" },
  { id: "acronym", chapter: "PURCAR" },
  { id: "domenii", chapter: "PURCAR" },
  { id: "final", chapter: "PURCAR" },
  { id: "multumire", chapter: "Final" },
] as const;

const team = [
  {
    name: "Robert Sabau",
    role: "problema, Well,Edu!, bac gratuit si agent AI pentru elevi",
  },
  {
    name: "Sergiu Chereches",
    role: "resurse, abonamente, costuri, venituri si coduri CAEN",
  },
  {
    name: "Tudor Marginean",
    role: "marketing 4P, promovare, pozitionare si comunitate",
  },
  {
    name: "Rus Vlad Andrei",
    role: "TalIA, research AI, demo produs si exemplul RL din Well,Edu!",
  },
  {
    name: "Streajan Andrei Mihai",
    role: "momentul ???, reveal, acronim si ecosistem domenii",
  },
];

const pricing = [
  {
    level: "Free",
    price: "0 lei",
    badge: "Bac complet",
    accent: "#3b82f6",
    text: "Lectii, probleme, simulari de baza si agent AI cu limita zilnica.",
  },
  {
    level: "Plus",
    price: "49 lei/luna",
    badge: "Progres",
    accent: "#22c55e",
    text: "Mai multe intrebari AI, rapoarte pe capitole si simulari extinse.",
  },
  {
    level: "Pro",
    price: "99 lei/luna",
    badge: "Olimpiada",
    accent: "#eab308",
    text: "Probleme de finete, concursuri premium si feedback AI avansat.",
  },
  {
    level: "Elite",
    price: "199 lei/luna",
    badge: "Mentorat",
    accent: "#a855f7",
    text: "Sesiuni cu profesori, Q&A live si plan personalizat de performanta.",
  },
  {
    level: "Friends Elite",
    price: "159 lei/luna",
    badge: "Grup de 5",
    accent: "#f97316",
    text: "Discount pentru tine si inca 4 prieteni care intra impreuna.",
  },
  {
    level: "Referral",
    price: "1 sesiune free",
    badge: "Invitatie",
    accent: "#14b8a6",
    text: "Daca vii printr-un prieten Elite, intri cu el la o sesiune gratuita.",
  },
];

const costs = [
  ["Hosting + API", "350-600 lei", "server, Vite/React, endpoint AI"],
  ["Baza de date", "150-300 lei", "Supabase, conturi, istoric si exports"],
  ["Tool-uri AI", "400-900 lei", "inference, testare agenti, experimente"],
  ["Marketing", "700-1.500 lei", "clipuri, ads, giveaways, comunitate"],
  ["Premii concursuri", "300-800 lei", "diplome, vouchere, materiale"],
  ["Profesori/mentori", "60% din Elite", "plata variaza in functie de numarul de elevi si sponsori"],
] satisfies Array<[string, string, string]>;

const revenue = [
  ["Abonamente", "venit recurent", "Plus, Pro, Elite si discounturi de grup"],
  ["Sponsori", "premii si buget", "branduri locale, companii IT, CSR"],
  ["Parteneriate", "validare", "profesori(speram), scoli, centre de pregatire"],
  ["Concursuri", "monetizare", "probe speciale, finale, bootcampuri"],
  ["Workshopuri", ":)", "AI, bac intensiv, olimpiada"],
  ["TalIA", "scalare", "agenti AI-profesori cand mentorii umani lipsesc"],
] satisfies Array<[string, string, string]>;

const teacherScenarios = [
  ["10 elevi Elite", "1.990 lei venit", "1.194 lei profesor / 796 lei platforma"],
  ["25 elevi Elite", "4.975 lei venit", "2.985 lei profesor / 1.990 lei platforma"],
  ["50 elevi Elite", "9.950 lei venit", "5.970 lei profesor / 3.980 lei platforma"],
  ["50 elevi Friends", "7.950 lei venit", "4.770 lei profesor / 3.180 lei platforma"],
] satisfies Array<[string, string, string]>;

const domains = [
  { name: "Quastt.Com", x: "18%", y: "30%" },
  { name: "lowkai.xyz/API", x: "82%", y: "30%" },
  { name: "lowkai.xyz", x: "18%", y: "74%" },
  { name: "Purcar.Me", x: "82%", y: "74%" },
];

const rlAgents = [
  ["Random baseline", "alege actiuni la intamplare si arata de ce recompensa conteaza"],
  ["Expected SARSA", "estimeaza actiuni bune folosind recompensa asteptata"],
  ["REINFORCE", "invata o politica directa prin reward acumulat"],
  ["Actor-Critic", "combina actorul care alege actiuni cu criticul care evalueaza"],
] satisfies Array<[string, string]>;

type EditContextValue = {
  isAdmin: boolean;
  overrides: Record<string, string>;
  saveOverride: (id: string, content: string) => void;
};

const PresentationEditContext = createContext<EditContextValue>({
  isAdmin: false,
  overrides: {},
  saveOverride: () => undefined,
});

export function EducationPowerpoint() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState(() => new Set(["intro"]));
  const [isAdmin, setIsAdmin] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const node = visible.target as HTMLElement;
        const index = Number(node.dataset.index || 0);
        setActiveIndex(index);
        setVisibleSlides((current) => new Set(current).add(node.id));
      },
      { threshold: [0.42, 0.58, 0.74] },
    );

    sectionRefs.current.forEach((section) => {
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(
        slideMeta.length - 1,
        Math.max(0, activeIndex + direction),
      );
      sectionRefs.current[nextIndex]?.scrollIntoView({ behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex]);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const client = supabase;

    let mounted = true;

    async function loadOverrides() {
      const { data } = await client
        .from("presentation_overrides")
        .select("id,content");

      if (!mounted || !data) {
        return;
      }

      setOverrides(
        Object.fromEntries(data.map((row) => [row.id, row.content])),
      );
    }

    async function checkAdmin(user?: { id?: string; email?: string | null } | null) {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      if (isHardcodedAdminEmail(user.email)) {
        setIsAdmin(true);
        return;
      }

      const { data } = await client
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(data?.role === "admin");
    }

    void loadOverrides();
    client.auth.getUser().then(({ data }) => void checkAdmin(data.user));

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void checkAdmin(session?.user);
    });

    const channel = client
      .channel("presentation-overrides")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presentation_overrides" },
        (payload) => {
          const row = payload.new as { id?: string; content?: string };
          if (!row.id || typeof row.content !== "string") {
            return;
          }
          const id = row.id;
          setOverrides((current) => ({ ...current, [id]: row.content as string }));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, []);

  function goTo(index: number) {
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth" });
  }

  function saveOverride(id: string, content: string) {
    setOverrides((current) => ({ ...current, [id]: content }));

    if (!supabase || !isAdmin) {
      return;
    }
    const client = supabase;

    void client.from("presentation_overrides").upsert({
      id,
      content,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <PresentationEditContext.Provider value={{ isAdmin, overrides, saveOverride }}>
      <main className="r1p-shell">
      <header className="r1p-topbar">
        <a className="r1p-brand" href="#intro">
          ReformOne
          <span>Plan de afaceri</span>
        </a>
        {isAdmin && <span className="r1p-admin-chip">Admin editare live</span>}
      </header>

      <Slide
        id="intro"
        index={0}
        refSetter={(node) => {
          sectionRefs.current[0] = node;
        }}
        visible={visibleSlides.has("intro")}
      >
        <div className="r1p-frame">
          <div className="r1p-hero-copy">
            <p>Plan de afaceri / prezentare 10-12 minute</p>
            <h1>REFORMONE</h1>
            <span>Well,Edu! | TalIA | AI central</span>
          </div>
          <OrbitCore />
          <div className="r1p-hero-note">
            Organizatie educationala si AI, impartita in pregatire scolara,
            cercetare si produs conversational.
          </div>
          <h2>Educatie gratuita. Performanta premium. Research AI.</h2>
          <div className="r1p-team-strip">
            {team.map((member) => (
              <span key={member.name}>{member.name}</span>
            ))}
          </div>
        </div>
      </Slide>

      <Slide
        id="market"
        index={1}
        refSetter={(node) => {
          sectionRefs.current[1] = node;
        }}
        visible={visibleSlides.has("market")}
      >
        <SlideText
          kicker="02 / Oportunitate EdTech"
          title="Piata EdTech creste rapid, iar elevii cauta solutii mai personalizate."
          lead="Conform ReportLinker, piata globala EdTech a fost evaluata la 254,8 miliarde $ in 2021 si este estimata la 605,4 miliarde $ pana in 2027. Pentru Well,Edu!, asta inseamna o fereastra buna pentru educatie online, AI si competitii."
        />
        <ChartPanel
          alt="Grafic crestere piata EdTech"
          src="/education/powerpoint/assets/edtech-market.png"
          source="Sursa: ReportLinker / GlobeNewswire, EdTech Market Outlook 2022-2027"
        />
      </Slide>

      <Slide
        id="misiune"
        index={2}
        refSetter={(node) => {
          sectionRefs.current[2] = node;
        }}
        visible={visibleSlides.has("misiune")}
      >
        <SlideText
          kicker="03 / ReformOne"
          title="Misiunea este sa facem invatarea clara, accesibila si masurabila."
          lead="ReformOne combina educatia online, mentoratul si AI-ul intr-un ecosistem in care elevul poate invata, concura si primi feedback fara sa depinda de norocul de a gasi profesorul potrivit."
        />
        <MetricStrip
          metrics={[
            ["10-12 min", "durata prezentarii"],
            ["2 directii", "Well,Edu! si TalIA"],
            ["1 produs central", "AI conversational"],
          ]}
        />
      </Slide>

      <Slide
        id="problema"
        index={3}
        refSetter={(node) => {
          sectionRefs.current[3] = node;
        }}
        visible={visibleSlides.has("problema")}
      >
        <SlideText
          kicker="04 / Robert Sabau"
          title="Pregatirea pentru bac si olimpiade este fragmentata."
          lead="Elevii cauta lectii pe mai multe site-uri, platesc meditatii scumpe si primesc greu feedback adaptat nivelului lor. Rezultatul este multa munca, dar putina directie."
        />
        <CardGrid
          cards={[
            ["Cost", "Profesorii foarte buni sunt greu de gasit si devin rapid scumpi."],
            ["Ritm", "Elevul are nevoie de explicatii exact cand ramane blocat."],
            ["Personalizare", "Aceeasi lectie nu functioneaza pentru toti elevii si toate obiectivele."],
          ]}
        />
      </Slide>

      <Slide
        id="solutie"
        index={4}
        refSetter={(node) => {
          sectionRefs.current[4] = node;
        }}
        visible={visibleSlides.has("solutie")}
      >
        <SlideText
          kicker="05 / Well,Edu!"
          title="Well,Edu! transforma pregatirea intr-o platforma completa."
          lead="Platforma uneste lectii gratuite, simulari, concursuri lunare, profesori si agenti AI ( ultimele versiuni ) pe materii."
        />
        <IconGrid
          items={[
            [<GraduationCap />, "Materie structurata", "Bacalaureat pe capitole, explicatii si probleme rezolvate."],
            [<CalendarDays />, "Simulari lunare", "Teste recurente cu feedback si progres vizibil."],
            [<Bot />, "Agenti AI", "Intrebari, explicatii, probleme noi si recapitulare."],
            [<Users />, "Mentori", "Profesori si oameni specializati pentru zona premium."],
          ]}
        />
      </Slide>

      <Slide
        id="bac-gratuit"
        index={5}
        refSetter={(node) => {
          sectionRefs.current[5] = node;
        }}
        visible={visibleSlides.has("bac-gratuit")}
      >
        <SlideText
          kicker="06 / Bac gratuit"
          title="Tot ce tine de bacalaureat ramane gratuit."
          lead="Acesta este mecanismul prin care Well,Edu! castiga incredere: elevul intra pentru ajutor real, primeste valoare imediata si poate avansa ulterior spre continut premium."
        />
        <CheckList
          items={[
            "lectii complete pentru materiile de bac, organizate pe capitole",
            "probleme si exercitii rezolvate pas cu pas",
            "simulari online gratuite cu feedback automat",
            "agent AI gratuit pentru intrebari, recapitulare si planuri de invatare",
            "capitole gratuite si in afara programei: Inteligenta Artificiala, Cibernetica si securitate digitala",
          ]}
        />
      </Slide>

      <Slide
        id="agent-ai"
        index={6}
        refSetter={(node) => {
          sectionRefs.current[6] = node;
        }}
        visible={visibleSlides.has("agent-ai")}
      >
        <SlideText
          kicker="07 / Agent AI gratuit"
          title="Elevul poate intreba, verifica si genera probleme noi."
          lead="Agentul gratuit este gandit ca un tutor de lucru: explica o problema, arata alta metoda, genereaza exercitii asemanatoare si construieste un plan de invatare pentru urmatoarele zile."
        />
        <IconGrid
          items={[
            [<Sparkles />, "Explicatii clare", "Rezolvari pas cu pas si reformulari cand elevul nu intelege."],
            [<FileText />, "Probleme noi", "Exercitii create dupa capitol, nivel si tipul de greseala."],
            [<CheckCircle2 />, "Feedback", "Corectare si indicii fara a sari direct la raspuns."],
            [<CalendarDays />, "Plan personal", "Recapitulare pe zile pentru bac sau olimpiada."],
          ]}
        />
      </Slide>

      <Slide
        id="competitii"
        index={7}
        refSetter={(node) => {
          sectionRefs.current[7] = node;
        }}
        visible={visibleSlides.has("competitii")}
      >
        <SlideText
          kicker="08 / Competitii lunare"
          title="Concursurile tin elevii activi si fac progresul vizibil."
          lead="Well,Edu! organizeaza simulari de bac, probe de olimpiada si maratoane de exercitii. Fiecare editie are clasament, feedback si premii. Folosim gamificarea cu grija: leaderboard, badge-uri si recompense pentru progres, nu doar puncte fara sens."
        />
        <div className="r1p-split-chart">
          <div className="r1p-timeline">
            {["Inscriere", "Simulare", "Feedback", "Leaderboard", "Premii"].map(
              (step, index) => (
                <article key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </article>
              ),
            )}
          </div>
          <ChartPanel
            alt="Grafic impact gamification in educatie"
            src="/education/powerpoint/assets/gamification-impact.png"
            source="Surse: Sailer & Homner meta-analysis; Landers & Landers leaderboard study"
          />
        </div>
      </Slide>

      <Slide
        id="rl-capitol"
        index={8}
        refSetter={(node) => {
          sectionRefs.current[8] = node;
        }}
        visible={visibleSlides.has("rl-capitol")}
      >
        <SlideText
          kicker="09 / Capitol gratuit exemplu"
          title="Reinforcement Learning: ce poti construi dupa ce inveti capitolul."
          lead="In Well,Edu!, un capitol gratuit poate explica state, action, reward, policy si training. La final, elevul vede agenti care invata sa tina bara in echilibru in CartPole-v1, nu doar teorie."
        />
        <div className="r1p-rl-layout">
          <div className="r1p-rl-agents">
            {rlAgents.map(([name, text], index) => (
              <article key={name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{name}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="r1p-demo-surface">
            <CartPoleArena compact />
          </div>
        </div>
      </Slide>

      <Slide
        id="premium"
        index={9}
        refSetter={(node) => {
          sectionRefs.current[9] = node;
        }}
        visible={visibleSlides.has("premium")}
      >
        <SlideText
          kicker="10 / Zona premium"
          title="Premium-ul este pentru finete, olimpiade si mentorat."
          lead="Bacul ramane gratuit, iar monetizarea vine din elemente de performanta dificil de gasit: metode elegante, probleme avansate, agenti AI specializati si contact direct cu profesori buni."
        />
        <CardGrid
          cards={[
            ["Metode elegante", "Solutii scurte, observatii fine si trucuri avansate pentru performanta."],
            ["Olimpiada", "Probleme dificile, strategii de rezolvare si feedback aprofundat."],
            ["Mentorat", "Sesiuni cu profesori si agenti AI specializati pe materie."],
          ]}
        />
      </Slide>

      <Slide
        id="abonamente"
        index={10}
        refSetter={(node) => {
          sectionRefs.current[10] = node;
        }}
        visible={visibleSlides.has("abonamente")}
      >
        <SlideText
          kicker="11 / Abonamente si discounturi"
          title="Model freemium"
          lead="Elevii intra fara costuri pentru bac. Venitul apare atunci cand au nevoie de performanta, mentorat, sau un grup de prieteni care invata impreuna."
        />
        <PricingGrid />
      </Slide>

      <Slide
        id="costuri"
        index={11}
        refSetter={(node) => {
          sectionRefs.current[11] = node;
        }}
        visible={visibleSlides.has("costuri")}
      >
        <SlideText
          kicker="12 / Costuri lunare aproximative"
          title="Costurile sunt controlabile si cresc odata cu utilizatorii."
          lead="La inceput, infrastructura ramane mica. Pentru profesorii Elite propunem un model realist: aproximativ 60% din pretul abonamentului merge la profesor si 40% ramane platformei inainte de costuri. Procentul poate creste daca avem sponsori si mai multi utilizatori."
        />
        <div className="r1p-finance-layout">
          <div className="r1p-finance-stack">
            <DataCards items={costs} />
            <div className="r1p-teacher-scenarios">
              {teacherScenarios.map(([title, value, text]) => (
                <article key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
          <ChartPanel
            alt="Grafic costuri lunare estimate"
            src="/education/powerpoint/assets/monthly-costs.png"
            source="Estimare interna ReformOne. Exemplu: 50 x 199 lei x 60% = 5.970 lei/luna pentru profesor."
          />
        </div>
      </Slide>

      <Slide
        id="venituri"
        index={12}
        refSetter={(node) => {
          sectionRefs.current[12] = node;
        }}
        visible={visibleSlides.has("venituri")}
      >
        <SlideText
          kicker="13 / De unde luam bani"
          title="Veniturile combina abonamente, sponsori si parteneriate."
          lead="Modelul principal este recurent, dar competitiile lunare pot atrage sponsori, premii si parteneri. Workshopurile ( orele cu profesorii,agenti,etc ) creeaza rapid o sursa de venit, iar TalIA reduce dependenta de profesori disponibili(((:."
        />
        <div className="r1p-finance-layout">
          <DataCards items={revenue} />
          <ChartPanel
            alt="Grafic venituri lunare estimate"
            src="/education/powerpoint/assets/monthly-revenue.png"
            source="Estimare interna ReformOne, mix abonamente + sponsori."
          />
        </div>
      </Slide>

      <Slide
        id="resurse"
        index={13}
        refSetter={(node) => {
          sectionRefs.current[13] = node;
        }}
        visible={visibleSlides.has("resurse")}
      >
        <SlideText
          kicker="14 / Sergiu Chereches"
          title="Resursele companiei sunt materiale, financiare si umane."
          lead="-"
        />
        <IconGrid
          items={[
            [<Database />, "Materiale", "platforma, domenii, servere, lectii, sistem de concursuri"],
            [<CircleDollarSign />, "Financiare", "hosting, marketing, premii, profesori si mentori"],
            [<Users />, "Umane", "echipa fondatoare, profesori, creatori de continut, dezvoltatori AI"],
            [<Cpu />, "Tehnice", "Baza de date, API-uri, modele AI si export de conversatii pentru training"],
          ]}
        />
      </Slide>

      <Slide
        id="caen"
        index={14}
        refSetter={(node) => {
          sectionRefs.current[14] = node;
        }}
        visible={visibleSlides.has("caen")}
      >
        <SlideText
          kicker="15 / Organizare juridica"
          title="Codurile CAEN relevante sustin educatia online si platforma software."
          lead="Pentru versiunea curenta pastram doar coduri care au legatura directa cu proiectul: educatie, dezvoltare software si portal web. Codurile de plasare sau asistenta sociala nu intra in proiectul actual."
        />
        <CardGrid
          cards={[
            ["CAEN 8559", "Alte forme de invatamant n.c.a. - cursuri, pregatire, lectii si mentorat online."],
            ["CAEN 6201 / 6210", "Realizarea softului la comanda - platforma, agenti AI si instrumente interne."],
            ["CAEN 6312", "Portaluri web - operarea platformei si a ecosistemului de domenii."],
          ]}
        />
      </Slide>

      <Slide
        id="marketing"
        index={15}
        refSetter={(node) => {
          sectionRefs.current[15] = node;
        }}
        visible={visibleSlides.has("marketing")}
      >
        <SlideText
          kicker="16 / Tudor Marginean"
          title="Marketing 4P: produs clar, pret accesibil, distributie online."
          lead="-"
        />
        <IconGrid
          items={[
            [<Rocket />, "Product", "Well,Edu!, TalIA si AI-ul central ca ecosistem."],
            [<CircleDollarSign />, "Price", "freemium cu Free, Plus, Pro, Elite si discounturi de grup."],
            [<Network />, "Place", "100% online, accesibil de oriunde prin site si cont personal."],
            [<Megaphone />, "Promotion", "TikTok, Reels, Discord, referral, demo-uri si profesori parteneri."],
          ]}
        />
      </Slide>

      <Slide
        id="promovare"
        index={16}
        refSetter={(node) => {
          sectionRefs.current[16] = node;
        }}
        visible={visibleSlides.has("promovare")}
      >
        <SlideText
          kicker="17 / Instrumente de promovare"
          title="Promovarea arata produsul in actiune, nu doar promite rezultate."
          lead="Campaniile se bazeaza pe demo-uri scurte: o problema explicata de agent, o simulare gratuita, sau un clip cu un elev care intelege un truc de olimpiada."
        />
        <PillFlow
          items={[
            "TikTok si Reels",
            "Discord pentru comunitate",
            "YouTube Shorts",
            "referral intre elevi",
            "parteneriate cu profesori",
            "simulari gratuite de lansare",
          ]}
        />
      </Slide>

      <Slide
        id="talia"
        index={17}
        refSetter={(node) => {
          sectionRefs.current[17] = node;
        }}
        visible={visibleSlides.has("talia")}
      >
        <SlideText
          kicker="18 / Rus Vlad Andrei"
          title="TalIA este partea de research AI a ReformOne."
          lead="TalIA urmareste noutati AI, experimente, concursuri si proiecte proprii. Daca nu avem suficienti profesori umani, dezvoltam agenti AI-profesori specializati pe materii, antrenati pe lectii, probleme si feedback real."
        />
        <div className="r1p-research-line">
          <span>papers</span>
          <span>benchmark-uri</span>
          <span>concursuri AI</span>
          <span>agenti AI-profesori</span>
        </div>
      </Slide>

      <Slide
        id="intrebare"
        index={18}
        refSetter={(node) => {
          sectionRefs.current[18] = node;
        }}
        visible={visibleSlides.has("intrebare")}
        variant="question"
      >
        <div className="r1p-question">
          <EditableText as="p" id="question.kicker">
            19 / Streajan Andrei Mihai
          </EditableText>
          <EditableText as="h2" id="question.title">
            ???
          </EditableText>
          <EditableText as="span" id="question.lead">
            :) care este AI-ul central?
          </EditableText>
        </div>
      </Slide>

      <Slide
        id="purcar"
        index={19}
        refSetter={(node) => {
          sectionRefs.current[19] = node;
        }}
        visible={visibleSlides.has("purcar")}
        variant="purcar-reveal"
      >
        <div className="r1p-purcar-reveal">
          <EditableText as="p" id="purcar-reveal.kicker">
            20 / Reveal
          </EditableText>
          <EditableText as="h1" id="purcar-reveal.title">
            free talk before reveal :)

          </EditableText>
          <EditableText as="span" id="purcar-reveal.lead">
            AI-ul central pentru invatare, recapitulare si research
          </EditableText>
        </div>
      </Slide>

      <Slide
        id="acronym"
        index={20}
        refSetter={(node) => {
          sectionRefs.current[20] = node;
        }}
        visible={visibleSlides.has("acronym")}
      >
        <div className="r1p-acronym">
          <EditableText as="p" id="acronym.kicker">
            21 / Personalized Understanding and Reasoning Companion for Academic Revision
          </EditableText>
          <EditableText as="h2" id="acronym.title">
            Personalized Understanding and Reasoning Companion for Academic Revision
          </EditableText>
          <EditableText as="span" id="acronym.lead">
            Companion AI pentru invatare, recapitulare, probleme, research si
            dialog academic personalizat.
          </EditableText>
        </div>
      </Slide>

      <Slide
        id="domenii"
        index={21}
        refSetter={(node) => {
          sectionRefs.current[21] = node;
        }}
        visible={visibleSlides.has("domenii")}
        variant="domains"
      >
        <SlideText
          kicker="22 / Ecosistem PURCAR"
          title="Toate drumurile duc spre Purcar.Me."
          lead="Quastt.Com si lowkai.xyz pot functiona ca intrari diferite, iar lowkai.xyz ramane zona pentru API-uri. Destinatia principala pentru produsul conversational ramane Purcar.Me."
        />
        <StaticDomainMap />
      </Slide>

      <Slide
        id="final"
        index={22}
        refSetter={(node) => {
          sectionRefs.current[22] = node;
        }}
        visible={visibleSlides.has("final")}
      >
        <SlideText
          kicker="23 / Final: PURCAR in prim plan"
          title="PURCAR devine interfata principala a ReformOne."
          lead="La final, prezentarea se intoarce la produs: chat-uri, conturi, istoric, ajutor pentru bac si olimpiade, research si export de conversatii pentru antrenarea modelelor."
        />
        <div className="r1p-final-grid">
          <PurcarPreview />
          <div className="r1p-final-panel">
            <MiniPurcarWidget />
            <CheckList
              items={[
                "creezi conversatii si pastrezi istoricul in cont",
                "intrebi despre bacalaureat, olimpiade si research AI",
                "exporti chat-uri in format util pentru training viitor",
              ]}
            />
          </div>
        </div>
      </Slide>

      <Slide
        id="multumire"
        index={23}
        refSetter={(node) => {
          sectionRefs.current[23] = node;
        }}
        visible={visibleSlides.has("multumire")}
        variant="thanks"
      >
        <div className="r1p-thanks">
          <EditableText as="p" id="thanks.kicker">
            24 / ReformOne
          </EditableText>
          <EditableText as="h2" id="thanks.title">
            Va multumim pentru atentia acordata
          </EditableText>
          <EditableText as="span" id="thanks.lead">
            Well,Edu! + TalIA + PURCAR
          </EditableText>
        </div>
      </Slide>

      <button
        className="r1p-next"
        onClick={() => goTo(Math.min(slideMeta.length - 1, activeIndex + 1))}
        type="button"
      >
        <ArrowDown size={18} />
      </button>
      </main>
    </PresentationEditContext.Provider>
  );
}

function Slide({
  id,
  index,
  refSetter,
  visible,
  variant,
  children,
}: {
  id: string;
  index: number;
  refSetter: (node: HTMLElement | null) => void;
  visible: boolean;
  variant?: string;
  children: ReactNode;
}) {
  const meta = slideMeta[index];
  return (
    <section
      className={[
        "r1p-slide",
        visible ? "is-visible" : "",
        variant ? `r1p-slide--${variant}` : "",
      ].join(" ")}
      data-index={index}
      id={id}
      ref={refSetter}
    >
      <div className="r1p-slide__number">
        {String(index + 1).padStart(2, "0")} / {meta.chapter}
      </div>
      <div className="r1p-slide__content">{children}</div>
    </section>
  );
}

function SlideText({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead: string;
}) {
  const number = kicker.match(/^\d+/)?.[0] || kicker.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const editBase = `slide-${number}`;

  return (
    <div className="r1p-copy">
      <EditableText as="p" id={`${editBase}.kicker`}>
        {kicker}
      </EditableText>
      <EditableText as="h2" id={`${editBase}.title`}>
        {title}
      </EditableText>
      <EditableText as="span" id={`${editBase}.lead`}>
        {lead}
      </EditableText>
    </div>
  );
}

function EditableText({
  as,
  id,
  children,
  className,
}: {
  as: "p" | "h1" | "h2" | "h3" | "span" | "strong";
  id: string;
  children: string;
  className?: string;
}) {
  const { isAdmin, overrides, saveOverride } = useContext(PresentationEditContext);
  const value = overrides[id] ?? children;
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ref.current && !isEditing) {
      ref.current.textContent = value;
    }
  }, [isEditing, value]);

  function startEditing() {
    if (!isAdmin) {
      return;
    }

    setIsEditing(true);
    window.setTimeout(() => {
      ref.current?.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      if (ref.current && selection) {
        range.selectNodeContents(ref.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 0);
  }

  function finishEditing(event: FocusEvent<HTMLElement>) {
    const nextValue = event.currentTarget.textContent?.trim() || children;
    setIsEditing(false);
    if (nextValue !== value) {
      saveOverride(id, nextValue);
    }
  }

  return createElement(
    as,
    {
      className: [
        className || "",
        isAdmin ? "r1p-editable" : "",
        isEditing ? "is-editing" : "",
      ].join(" "),
      contentEditable: isAdmin && isEditing,
      onBlur: finishEditing,
      onDoubleClick: startEditing,
      ref,
      suppressContentEditableWarning: true,
      title: isAdmin ? "Dublu click pentru editare" : undefined,
    },
    value,
  );
}

function OrbitCore() {
  return (
    <div className="r1p-orbit" aria-hidden="true">
      {orbitDots.map((dot) => (
        <span
          key={dot}
          style={
            {
              "--i": dot,
              "--total": orbitDots.length,
            } as CSSProperties
          }
        />
      ))}
      <div className="r1p-cube">
        <i />
        <b />
        <em />
      </div>
    </div>
  );
}

function CardGrid({ cards }: { cards: Array<[string, string]> }) {
  return (
    <div className="r1p-cards">
      {cards.map(([title, text], index) => (
        <article className={`r1p-card--tone-${(index % 4) + 1}`} key={title}>
          <span>{title}</span>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

function IconGrid({
  items,
}: {
  items: Array<[ReactNode, string, string]>;
}) {
  return (
    <div className="r1p-icon-grid">
      {items.map(([icon, title, text], index) => (
        <article className={`r1p-card--tone-${(index % 4) + 1}`} key={title}>
          <div>{icon}</div>
          <strong>{title}</strong>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <div className="r1p-check-list">
      {items.map((item) => (
        <article key={item}>
          <CheckCircle2 size={19} />
          <span>{item}</span>
        </article>
      ))}
    </div>
  );
}

function MetricStrip({ metrics }: { metrics: Array<[string, string]> }) {
  return (
    <div className="r1p-metric-strip">
      {metrics.map(([value, label], index) => (
        <article className={`r1p-card--tone-${index + 1}`} key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </article>
      ))}
    </div>
  );
}

function PillFlow({ items }: { items: string[] }) {
  return (
    <div className="r1p-pill-flow">
      {items.map((item, index) => (
        <article key={item}>
          <span>{item}</span>
          {index < items.length - 1 && <ArrowRight size={18} />}
        </article>
      ))}
    </div>
  );
}

function PricingGrid() {
  return (
    <div className="r1p-pricing r1p-pricing--six">
      {pricing.map((plan, index) => (
        <article
          key={plan.level}
          style={{ "--card-accent": plan.accent } as CSSProperties}
        >
          <span>LEVEL {String(index + 1).padStart(2, "0")}</span>
          <strong>{plan.level}</strong>
          <b>{plan.price}</b>
          <small>{plan.badge}</small>
          <p>{plan.text}</p>
        </article>
      ))}
    </div>
  );
}

function DataCards({ items }: { items: Array<[string, string, string]> }) {
  return (
    <div className="r1p-data-cards">
      {items.map(([title, value, text], index) => (
        <article className={`r1p-card--tone-${(index % 4) + 1}`} key={title}>
          <span>{title}</span>
          <strong>{value}</strong>
          <p>{text}</p>
        </article>
      ))}
    </div>
  );
}

function ChartPanel({
  src,
  alt,
  source,
}: {
  src: string;
  alt: string;
  source: string;
}) {
  return (
    <figure className="r1p-chart-panel">
      <img alt={alt} src={src} />
      <figcaption>{source}</figcaption>
    </figure>
  );
}

function StaticDomainMap() {
  return (
    <div className="r1p-domain-stage r1p-domain-stage--static">
      <svg aria-hidden="true" className="r1p-domain-lines" viewBox="0 0 100 100">
        <defs>
          <marker
            id="r1p-arrow"
            markerHeight="6"
            markerWidth="6"
            orient="auto"
            refX="5"
            refY="3"
          >
            <path d="M0,0 L6,3 L0,6 Z" />
          </marker>
        </defs>
        <path d="M18 30 L47 48" />
        <path d="M82 30 L53 48" />
        <path d="M18 74 L47 52" />
        <path d="M82 74 L53 52" />
      </svg>
      <div className="r1p-domain-center">
        <Network size={26} />
        <strong>Purcar.Me</strong>
      </div>
      {domains.map((domain) => (
        <a
          className="r1p-domain"
          href="https://purcar.me"
          key={domain.name}
          style={
            {
              "--x": domain.x,
              "--y": domain.y,
            } as CSSProperties
          }
        >
          {domain.name}
        </a>
      ))}
    </div>
  );
}

function PurcarPreview() {
  return (
    <div className="r1p-purcar-preview">
      <header>
        <strong>PURCAR-1</strong>
        <a href="/">
          Deschide <ArrowUpRight size={15} />
        </a>
      </header>
      <div>
        <h3>Hi, I'm PURCAR</h3>
        <p>Interact with ReformOne and explore education, research and AI.</p>
      </div>
      <footer>
        <button type="button">New chat</button>
        <button type="button">Bac assistant</button>
        <button type="button">Export JSONL</button>
      </footer>
    </div>
  );
}
