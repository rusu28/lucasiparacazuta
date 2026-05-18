import type { DeckSlide, TaxiAgentProfile } from "../lib/types";

export const deckSlides: DeckSlide[] = [
  {
    id: "intro",
    eyebrow: "ReformOne",
    title: "An organization split between education and AI research.",
    lead:
      "Well,Edu! prepares students through monthly contests, simulations, and smart study sessions. TalIA turns AI into a research and competition lab.",
  },
  {
    id: "architecture",
    eyebrow: "Concept",
    title: "A premium format for accelerated learning.",
    lead:
      "The site works like a living pitch: fewer words, larger scenes, interactive demos, and a clear story about how students learn with AI.",
    details: [
      "complete curriculum for excellence and final exams",
      "monthly simulations with leaderboards and feedback",
      "AI agents specialized by subject",
      "human mentors for validation and strategy",
    ],
  },
  {
    id: "education",
    eyebrow: "Well,Edu!",
    title: "Monthly contests for every subject.",
    lead:
      "Students can join final exam simulations or olympiad-style challenges, with analysis by chapter, difficulty, and mistake type.",
  },
  {
    id: "curriculum",
    eyebrow: "Curriculum Map",
    title: "The whole curriculum becomes a navigable system.",
    lead:
      "Every lesson includes theory, problems, solving techniques, quick tests, and automatic recommendations for the next step.",
  },
  {
    id: "mentors",
    eyebrow: "Tutors",
    title: "Specialized AI plus professional humans.",
    lead:
      "AI agents explain quickly, propose alternative methods, and find patterns. Teachers step in for strategy, fine-grained correction, and high-performance preparation.",
  },
  {
    id: "research",
    eyebrow: "TalIA",
    title: "Research, AI news, and applied competitions.",
    lead:
      "TalIA tracks model progress, organizes challenges, and produces demonstrable experiments for students and the public.",
  },
  {
    id: "arena",
    eyebrow: "Live Demo",
    title: "Four agents run in Taxi-v3.",
    lead:
      "During the presentation, you can show agents trained in PyTorch, loaded through a local API, and compared visually inside a Gymnasium environment.",
  },
  {
    id: "purcar",
    eyebrow: "PURCAR",
    title: "The central AI of ReformOne.",
    lead:
      "PURCAR is the conversational interface on Purcar.me: chats, accounts, history, conversation exports, and future connection to proprietary models.",
  },
  {
    id: "video",
    eyebrow: "Video Moment",
    title: "The demo can go directly into the presentation.",
    lead:
      "Add a video file to assets and the slide automatically becomes the stage for the main demonstration.",
  },
  {
    id: "interactive",
    eyebrow: "Interaction",
    title: "The audience can talk to the AI.",
    lead:
      "The presentation closes with a mini PURCAR chat as a natural transition to the official root site.",
  },
  {
    id: "platform",
    eyebrow: "Framework",
    title: "Ready for Supabase, accounts, and training data.",
    lead:
      "The structure includes the proposed schema for profiles, sessions, and messages, plus JSONL export for conversations used later in training.",
  },
];

export const taxiAgents: TaxiAgentProfile[] = [
  {
    id: "random-baseline",
    name: "Random Baseline",
    style: "simple comparison agent",
    modelHint: "TypeScript fallback, no model",
    accent: "#135dff",
  },
  {
    id: "expected_sarsa",
    name: "Expected SARSA",
    style: "PyTorch checkpoint exported to ONNX",
    modelHint: "/education/powerpoint/models/expected_sarsa.onnx",
    accent: "#18a058",
  },
  {
    id: "mountain_car_reinforce",
    name: "REINFORCE",
    style: "policy-gradient demo with 6 actions",
    modelHint: "/education/powerpoint/models/mountain_car_reinforce.onnx",
    accent: "#d48806",
  },
  {
    id: "actor_critic_mountain",
    name: "Actor-Critic",
    style: "actor + critic, runs locally in the browser",
    modelHint: "/education/powerpoint/models/actor_critic_mountain.onnx",
    accent: "#c41d7f",
  },
];

export const cartPoleAgents: TaxiAgentProfile[] = [
  {
    id: "random-baseline",
    name: "Random Baseline",
    style: "chooses left/right without training",
    modelHint: "fallback random",
    accent: "#135dff",
  },
  {
    id: "expected_sarsa",
    name: "Expected SARSA",
    style: "Q-values pentru actiuni discrete",
    modelHint: "/education/powerpoint/models/expected_sarsa.onnx",
    accent: "#18a058",
  },
  {
    id: "mountain_car_reinforce",
    name: "REINFORCE",
    style: "policy logits pentru stanga/dreapta",
    modelHint: "/education/powerpoint/models/mountain_car_reinforce.onnx",
    accent: "#d48806",
  },
  {
    id: "actor_critic_mountain",
    name: "Actor-Critic",
    style: "actor logits plus critic value",
    modelHint: "/education/powerpoint/models/actor_critic_mountain.onnx",
    accent: "#c41d7f",
  },
];

export const curriculumRows = [
  ["Matematica", "bac M1/M2", "olimpiada", "algebra, analiza, geometrie"],
  ["Informatica", "bac C++", "olimpiada", "grafuri, DP, structuri de date"],
  ["Romana", "bac", "performanta", "eseuri, argumentare, grile"],
  ["Fizica", "bac", "olimpiada", "mecanica, electricitate, optica"],
  ["Chimie", "bac", "olimpiada", "organica, anorganica, probleme"],
];
