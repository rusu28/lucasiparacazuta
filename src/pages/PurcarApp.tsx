import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  LifeBuoy,
  LogIn,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCircle,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { generatePurcarReply } from "../lib/purcarModelClient";
import { isHardcodedAdminEmail } from "../lib/adminAccess";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { ChatMessage, ChatSession } from "../lib/types";

const creativityKey = "reformone-purcar-creativity";
const temperatureKey = "reformone-purcar-temperature";
const topKKey = "reformone-purcar-top-k";
const repetitionPenaltyKey = "reformone-purcar-repetition-penalty";
const usageKey = "reformone-purcar-token-window";
const sessionsKeyPrefix = "reformone-purcar-chat-sessions";
const memoryEnabledKey = "reformone-purcar-memory-enabled";
const memoryCountKey = "reformone-purcar-memory-count";
const guestTokenLimit = 25_000;
const accountTokenLimit = 100_000;
const verifiedAccountTokenLimit = 150_000;
const usageWindowMs = 7 * 24 * 60 * 60 * 1000;
const demoEliteEmail =
  (import.meta.env.VITE_DEMO_ELITE_EMAIL as string | undefined) ||
  "proiect+antre.elite@lowkai.xyz";
const demoElitePassword = import.meta.env.VITE_DEMO_ELITE_PASSWORD as
  | string
  | undefined;
const demoEliteUsername =
  (import.meta.env.VITE_DEMO_ELITE_USERNAME as string | undefined) ||
  "TheOrangeJuice";

type UserProfile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  role: "admin" | "organizer" | "student" | "member";
  plan: "free" | "plus" | "pro" | "elite";
  creativity: number;
  top_k: number;
  repetition_penalty: number;
  email_verified: boolean;
};

type AuthMode = "signin" | "signup";
type SchemaLikeError = { message?: string; code?: string } | null | undefined;
type TokenUsage = {
  windowStartedAt: string;
  tokensUsed: number;
};
type CloudSaveState = "local" | "saving" | "saved" | "error";

function now() {
  return new Date().toISOString();
}

function uid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(char) / 4)))
    ).toString(16),
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function initialsFrom(value?: string | null) {
  const parts = (value || "PURCAR User").trim().split(/[\s_]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "P"
  );
}

function createSession(title = "New chat"): ChatSession {
  const timestamp = now();
  return {
    id: uid(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
}

function loadLocalCreativity() {
  const raw = Number(localStorage.getItem(creativityKey));
  return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 50;
}

function temperatureFromCreativity(creativity: number) {
  return Number(((Math.min(100, Math.max(0, creativity)) / 100) * 2).toFixed(2));
}

function clampTemperature(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Number(Math.min(1000, Math.max(0.01, value)).toFixed(2));
}

function loadLocalTemperature() {
  return clampTemperature(Number(localStorage.getItem(temperatureKey) || 1));
}

function clampTopK(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(50_000, Math.max(1, Math.round(value)));
}

function loadLocalTopK() {
  return clampTopK(Number(localStorage.getItem(topKKey) || 50));
}

function clampRepetitionPenalty(value: number) {
  if (!Number.isFinite(value)) {
    return 1.15;
  }

  return Number(Math.min(4, Math.max(1, value)).toFixed(2));
}

function loadLocalRepetitionPenalty() {
  return clampRepetitionPenalty(
    Number(localStorage.getItem(repetitionPenaltyKey) || 1.15),
  );
}

function normalizeTokenWindow(data?: TokenUsage | null): TokenUsage {
  const startedFallback = new Date().toISOString();
  const candidate = data || { windowStartedAt: startedFallback, tokensUsed: 0 };
  const age = Date.now() - new Date(candidate.windowStartedAt).getTime();
  return age > usageWindowMs
    ? { windowStartedAt: startedFallback, tokensUsed: 0 }
    : candidate;
}

function tokenUsageStorageKey(ownerId: string | null) {
  return `${usageKey}:${ownerId || "guest"}`;
}

function loadLocalTokenUsage(ownerId: string | null = null) {
  try {
    const raw =
      localStorage.getItem(tokenUsageStorageKey(ownerId)) ||
      (ownerId ? null : localStorage.getItem(usageKey));
    return normalizeTokenWindow(raw ? (JSON.parse(raw) as TokenUsage) : null);
  } catch {
    return normalizeTokenWindow(null);
  }
}

function loadMemoryEnabled() {
  return localStorage.getItem(memoryEnabledKey) === "true";
}

function loadMemoryCount() {
  const raw = Number(localStorage.getItem(memoryCountKey));
  return Number.isFinite(raw) ? Math.min(200, Math.max(1, Math.round(raw))) : 12;
}

function formatChatMemory(messages: ChatMessage[], nextInput: string, messageCount: number) {
  const history = messages.slice(-messageCount);
  const lines = history.map((message) =>
    message.role === "assistant"
      ? `Assistant: ${message.content}`
      : `User: ${message.content}`,
  );

  lines.push(`User: ${nextInput}`);
  lines.push("Assistant:");
  return lines.join("\n");
}

function sessionsStorageKey(ownerId: string | null) {
  return `${sessionsKeyPrefix}:${ownerId || "guest"}`;
}

function sortSessions(items: ChatSession[]) {
  return [...items].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
  );
}

function isChatSession(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as ChatSession;
  return (
    typeof session.id === "string" &&
    typeof session.title === "string" &&
    typeof session.createdAt === "string" &&
    typeof session.updatedAt === "string" &&
    Array.isArray(session.messages)
  );
}

function loadLocalSessions(ownerId: string | null) {
  try {
    const raw = localStorage.getItem(sessionsStorageKey(ownerId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? sortSessions(parsed.filter(isChatSession)) : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(ownerId: string | null, nextSessions: ChatSession[]) {
  localStorage.setItem(sessionsStorageKey(ownerId), JSON.stringify(sortSessions(nextSessions)));
}

function mergeSessions(...groups: ChatSession[][]) {
  const byId = new Map<string, ChatSession>();

  for (const session of groups.flat()) {
    const existing = byId.get(session.id);
    if (!existing) {
      byId.set(session.id, session);
      continue;
    }

    const existingTime = new Date(existing.updatedAt).getTime();
    const sessionTime = new Date(session.updatedAt).getTime();
    const chosen = sessionTime >= existingTime ? session : existing;
    const messages = new Map<string, ChatMessage>();
    for (const message of [...existing.messages, ...session.messages]) {
      messages.set(message.id, message);
    }
    byId.set(session.id, {
      ...chosen,
      messages: [...messages.values()].sort(
        (first, second) =>
          new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
      ),
    });
  }

  return sortSessions([...byId.values()]);
}

function upsertSession(current: ChatSession[], session: ChatSession) {
  const next = current.some((item) => item.id === session.id)
    ? current.map((item) => (item.id === session.id ? session : item))
    : [session, ...current];

  return sortSessions(next);
}

function friendlyAuthError(error: SchemaLikeError) {
  const message = error?.message || "Authentication failed.";

  if (message.includes("captcha_token") || message.toLowerCase().includes("captcha")) {
    return "Supabase still has Captcha protection enabled. Disable it in Authentication > Attack Protection, then try again.";
  }

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (message.toLowerCase().includes("email not confirmed")) {
    return "Email is not confirmed yet. Check your inbox or use Magic link.";
  }

  return message;
}

function friendlySchemaStatus(error: SchemaLikeError, fallback: string) {
  const message = error?.message || "";
  if (
    message.includes("schema cache") ||
    message.includes("chat_sessions") ||
    message.includes("chat_messages") ||
    message.includes("profiles") ||
    message.includes("token_usage_windows") ||
    error?.code === "42P01"
  ) {
    return "Supabase schema is not applied. Run supabase/schema.sql, then reload the page.";
  }

  return message || fallback;
}

function profileFromUser(user: User, creativity: number): UserProfile {
  const isEliteSeed = user.email === demoEliteEmail;
  const isHardcodedAdmin = isHardcodedAdminEmail(user.email);
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.name ||
    (isEliteSeed ? "The Orange Juice" : user.email?.split("@")[0]) ||
    "Student";
  const username = normalizeUsername(
    isEliteSeed
      ? demoEliteUsername
      : user.user_metadata?.username || user.email?.split("@")[0] || displayName,
  );

  return {
    id: user.id,
    email: user.email || null,
    username,
    display_name: displayName,
    role: isHardcodedAdmin ? "admin" : "student",
    plan: isEliteSeed || isHardcodedAdmin ? "elite" : "free",
    creativity,
    top_k: loadLocalTopK(),
    repetition_penalty: loadLocalRepetitionPenalty(),
    email_verified:
      isHardcodedAdmin ||
      user.user_metadata?.purcar_email_verified === true,
  };
}

export function PurcarApp() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadLocalSessions(null));
  const [activeId, setActiveId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [localCreativity, setLocalCreativity] = useState(() => loadLocalCreativity());
  const [localTemperature, setLocalTemperature] = useState(() => loadLocalTemperature());
  const [localTopK, setLocalTopK] = useState(() => loadLocalTopK());
  const [localRepetitionPenalty, setLocalRepetitionPenalty] = useState(() =>
    loadLocalRepetitionPenalty(),
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsUsername, setSettingsUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [editingSessionId, setEditingSessionId] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteSessionId, setDeleteSessionId] = useState("");
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(() => loadLocalTokenUsage());
  const [memoryEnabled, setMemoryEnabled] = useState(() => loadMemoryEnabled());
  const [memoryCount, setMemoryCount] = useState(() => loadMemoryCount());
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>("local");
  const [syncStatus, setSyncStatus] = useState(
    isSupabaseConfigured ? "Checking session..." : "Supabase not configured",
  );
  const feedRef = useRef<HTMLDivElement | null>(null);
  const cloudSyncQueue = useRef(Promise.resolve());
  const cloudSchemaReady = useRef<boolean | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId),
    [activeId, sessions],
  );

  const isAuthenticated = Boolean(profile && userId);
  const isDemoElite = profile?.id === "demo-elite";
  const creativity = profile?.creativity ?? localCreativity;
  const temperature = localTemperature;
  const topK = localTopK;
  const repetitionPenalty = localRepetitionPenalty;
  const isAdmin = profile?.role === "admin" || isHardcodedAdminEmail(profile?.email);
  const tokenLimit = isAuthenticated
    ? profile?.email_verified
      ? verifiedAccountTokenLimit
      : accountTokenLimit
    : guestTokenLimit;
  const avatarText = initialsFrom(
    profile?.display_name || profile?.username || profile?.email,
  );
  const visibleMessages = (activeSession?.messages || []).slice(-200);
  const conversationStarted = Boolean(activeSession?.messages.length);
  const tokensLeft =
    isAdmin
      ? Number.POSITIVE_INFINITY
      : Math.max(0, tokenLimit - tokenUsage.tokensUsed);
  const tokenPercent = Number.isFinite(tokensLeft)
    ? Math.max(0, Math.min(100, (tokensLeft / tokenLimit) * 100))
    : 100;
  const tokenTitle = Number.isFinite(tokensLeft)
    ? `${tokensLeft.toLocaleString()} tokens left this week.`
    : "Unlimited tokens on this plan. Chats auto-save when you are signed in.";
  const saveStateLabel = !isAuthenticated
    ? "Saved on this device"
    : cloudSaveState === "saving"
      ? "Saving to cloud..."
      : cloudSaveState === "saved"
        ? "Saved to cloud"
        : cloudSaveState === "error"
          ? cloudSchemaReady.current === false
            ? "Saved locally, cloud setup required"
            : "Saved locally, cloud retry pending"
          : "Saved locally";

  useEffect(() => {
    localStorage.setItem(creativityKey, String(localCreativity));
  }, [localCreativity]);

  useEffect(() => {
    localStorage.setItem(temperatureKey, String(localTemperature));
  }, [localTemperature]);

  useEffect(() => {
    localStorage.setItem(topKKey, String(localTopK));
  }, [localTopK]);

  useEffect(() => {
    localStorage.setItem(repetitionPenaltyKey, String(localRepetitionPenalty));
  }, [localRepetitionPenalty]);

  useEffect(() => {
    saveLocalSessions(userId, sessions);
  }, [sessions, userId]);

  useEffect(() => {
    localStorage.setItem(memoryEnabledKey, String(memoryEnabled));
  }, [memoryEnabled]);

  useEffect(() => {
    localStorage.setItem(memoryCountKey, String(memoryCount));
  }, [memoryCount]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const retryCloudSync = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        for (const session of sessions) {
          queueSessionSync(session);
        }
      }
    };

    window.addEventListener("online", retryCloudSync);
    document.addEventListener("visibilitychange", retryCloudSync);
    return () => {
      window.removeEventListener("online", retryCloudSync);
      document.removeEventListener("visibilitychange", retryCloudSync);
    };
  }, [isAuthenticated, sessions, userId]);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [visibleMessages.length, activeId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "reset-password") {
      setPasswordOpen(true);
      setPasswordStatus("Enter your new password. You will be signed out after the change.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setSyncStatus("Supabase is not configured");
      return;
    }

    let mounted = true;

    async function handleUser(user: User | null) {
      if (!mounted) {
        return;
      }

      if (!user) {
        setUserId(null);
        setProfile(null);
        const guestSessions = loadLocalSessions(null);
        setSessions(guestSessions);
        setActiveId((current) =>
          current && guestSessions.some((session) => session.id === current)
            ? current
            : guestSessions[0]?.id,
        );
        setTokenUsage(loadLocalTokenUsage(null));
        setCloudSaveState("local");
        setSyncStatus("Sign in for saved chats");
        return;
      }

      const cachedSessions = mergeSessions(
        loadLocalSessions(user.id),
        loadLocalSessions(null),
      );
      setUserId(user.id);
      setProfile(profileFromUser(user, localCreativity));
      if (cachedSessions.length) {
        setSessions(cachedSessions);
        setActiveId((current) =>
          current && cachedSessions.some((session) => session.id === current)
            ? current
            : cachedSessions[0]?.id,
        );
      }
      setSyncStatus("Session active. Syncing profile...");
      const profileReady = await ensureProfile(user);
      if (!profileReady) {
        setCloudSaveState("error");
        return;
      }
      const mergedSessions = await loadCloudSessions(user.id, cachedSessions);
      for (const session of mergedSessions) {
        queueSessionSync(session, user.id);
      }
      await loadCloudTokenUsage(user.id);
    }

    supabase.auth.getSession().then(({ data }) => {
      void handleUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordOpen(true);
        setPasswordStatus("Enter your new password. You will be signed out after the change.");
      }
      void handleUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function ensureProfile(user: User) {
    if (!supabase) {
      return false;
    }

    const fallbackName =
      user.user_metadata?.display_name ||
      user.user_metadata?.name ||
      (user.email === demoEliteEmail ? "The Orange Juice" : user.email?.split("@")[0]) ||
      "Student";
    const fallbackUsername = normalizeUsername(
      user.email === demoEliteEmail
        ? demoEliteUsername
        : user.user_metadata?.username || user.email?.split("@")[0] || fallbackName,
    );
    const isEliteSeed = user.email === demoEliteEmail;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,email,username,display_name,role,plan,creativity,temperature,top_k,repetition_penalty",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      cloudSchemaReady.current = false;
      setSyncStatus(friendlySchemaStatus(error, "Profile could not be loaded."));
      return false;
    }

    if (data) {
      const isHardcodedAdmin = isHardcodedAdminEmail(data.email);
      const nextProfile = {
        id: data.id,
        email: data.email,
        username: data.username,
        display_name: data.display_name,
        role: isHardcodedAdmin ? "admin" : data.role || "student",
        plan: isHardcodedAdmin ? "elite" : data.plan || "free",
        creativity: data.creativity ?? 50,
        top_k: clampTopK(data.top_k ?? 50),
        repetition_penalty: clampRepetitionPenalty(data.repetition_penalty ?? 1.15),
        email_verified:
          isHardcodedAdmin ||
          user.user_metadata?.purcar_email_verified === true,
      } as UserProfile;
      setProfile(nextProfile);
      setLocalCreativity(nextProfile.creativity);
      setLocalTemperature(clampTemperature(data.temperature ?? 1));
      setLocalTopK(nextProfile.top_k);
      setLocalRepetitionPenalty(nextProfile.repetition_penalty);
      cloudSchemaReady.current = true;
      setSyncStatus("Cloud sync active");
      return true;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        username: fallbackUsername,
        display_name: isEliteSeed ? "The Orange Juice" : fallbackName,
        role: "student",
        plan: isEliteSeed ? "elite" : "free",
        creativity: localCreativity,
        temperature: localTemperature,
        top_k: localTopK,
        repetition_penalty: localRepetitionPenalty,
      })
      .select(
        "id,email,username,display_name,role,plan,creativity,temperature,top_k,repetition_penalty",
      )
      .single();

    if (insertError) {
      cloudSchemaReady.current = false;
      setSyncStatus(friendlySchemaStatus(insertError, "Profile could not be created."));
      return false;
    }

    setProfile({
      id: inserted.id,
      email: inserted.email,
      username: inserted.username,
      display_name: inserted.display_name,
      role: isHardcodedAdminEmail(inserted.email) ? "admin" : inserted.role || "student",
      plan: isHardcodedAdminEmail(inserted.email) ? "elite" : inserted.plan || "free",
      creativity: inserted.creativity ?? localCreativity,
      top_k: clampTopK(inserted.top_k ?? localTopK),
      repetition_penalty: clampRepetitionPenalty(
        inserted.repetition_penalty ?? localRepetitionPenalty,
      ),
      email_verified:
        isHardcodedAdminEmail(inserted.email) ||
        user.user_metadata?.purcar_email_verified === true,
    });
    setLocalTemperature(clampTemperature(inserted.temperature ?? localTemperature));
    setLocalTopK(clampTopK(inserted.top_k ?? localTopK));
    setLocalRepetitionPenalty(
      clampRepetitionPenalty(inserted.repetition_penalty ?? localRepetitionPenalty),
    );
    cloudSchemaReady.current = true;
    setSyncStatus("Cloud sync active");
    return true;
  }

  async function loadCloudSessions(ownerId: string, cachedSessions = loadLocalSessions(ownerId)) {
    if (!supabase) {
      return cachedSessions;
    }

    const { data: sessionRows, error } = await supabase
      .from("chat_sessions")
      .select("id,title,created_at,updated_at")
      .eq("user_id", ownerId)
      .order("updated_at", { ascending: false });

    if (error) {
      if (cachedSessions.length) {
        setSessions(cachedSessions);
        setActiveId((current) =>
          current && cachedSessions.some((session) => session.id === current)
            ? current
            : cachedSessions[0]?.id,
        );
      }
      setSyncStatus(friendlySchemaStatus(error, "Chats could not be loaded."));
      return cachedSessions;
    }

    if (!sessionRows?.length) {
      setSessions(cachedSessions);
      setActiveId((current) =>
        current && cachedSessions.some((session) => session.id === current)
          ? current
          : cachedSessions[0]?.id,
      );
      setSyncStatus("Cloud sync active");
      return cachedSessions;
    }

    const ids = sessionRows.map((session) => session.id);
    const { data: messageRows, error: messageError } = await supabase
      .from("chat_messages")
      .select("id,session_id,role,content,created_at")
      .in("session_id", ids)
      .order("created_at", { ascending: true });

    if (messageError) {
      setSyncStatus(friendlySchemaStatus(messageError, "Messages could not be loaded."));
    }

    const mapped = sessionRows.map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      messages: (messageRows || [])
        .filter((message) => message.session_id === session.id)
        .map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })) as ChatMessage[],
    }));

    const merged = mergeSessions(cachedSessions, mapped);

    setSessions(merged);
    setActiveId((current) =>
      current && merged.some((session) => session.id === current)
        ? current
        : merged[0]?.id,
    );
    saveLocalSessions(ownerId, merged);
    setSyncStatus("Cloud sync active");
    setCloudSaveState("saved");
    return merged;
  }

  async function loadCloudTokenUsage(ownerId: string) {
    if (!supabase) {
      return;
    }

    const { data } = await supabase
      .from("token_usage_windows")
      .select("window_started_at,tokens_used")
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!data) {
      setTokenUsage(normalizeTokenWindow(null));
      return;
    }

    setTokenUsage(
      normalizeTokenWindow({
        windowStartedAt: data.window_started_at,
        tokensUsed: data.tokens_used || 0,
      }),
    );
  }

  async function createChatSession(title = "New chat") {
    const session = createSession(title);

    setSessions((current) => upsertSession(current, session));
    setActiveId(session.id);
    if (isAuthenticated) {
      queueSessionSync(session);
    } else {
      setCloudSaveState("local");
      setSyncStatus("Guest chats are saved on this device");
    }
    return session;
  }

  async function syncSessionToCloud(session: ChatSession, ownerId = userId) {
    if (!supabase || !ownerId || isDemoElite || !isUuid(session.id) || !isUuid(ownerId)) {
      return false;
    }

    setCloudSaveState("saving");
    const { error: sessionError } = await supabase.from("chat_sessions").upsert({
      id: session.id,
      user_id: ownerId,
      title: session.title,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    }, { onConflict: "id" });

    if (sessionError) {
      setSyncStatus(friendlySchemaStatus(sessionError, "Could not save the chat."));
      setCloudSaveState("error");
      return false;
    }

    if (!session.messages.length) {
      setSyncStatus("Cloud sync active");
      setCloudSaveState("saved");
      return true;
    }

    const { error: messageError } = await supabase.from("chat_messages").upsert(
      session.messages
        .filter((message) => isUuid(message.id))
        .map((message) => ({
          id: message.id,
          session_id: session.id,
          role: message.role,
          content: message.content,
          created_at: message.createdAt,
          training_eligible: true,
        })),
      { onConflict: "id" },
    );

    setSyncStatus(
      messageError
        ? friendlySchemaStatus(messageError, "Could not save messages.")
        : "Cloud sync active",
    );
    setCloudSaveState(messageError ? "error" : "saved");
    return !messageError;
  }

  function queueSessionSync(session: ChatSession, ownerId = userId) {
    if (!supabase || !ownerId || isDemoElite || cloudSchemaReady.current === false) {
      return;
    }

    cloudSyncQueue.current = cloudSyncQueue.current
      .catch(() => undefined)
      .then(() => syncSessionToCloud(session, ownerId))
      .then(() => undefined);
  }

  async function registerTokenUsage(tokenCount: number) {
    if (isAdmin) {
      return true;
    }

    const startedFallback = new Date().toISOString();

    if (!supabase || isDemoElite || !userId || !isAuthenticated) {
      const usageOwnerId = isAuthenticated ? userId : null;
      const windowData = normalizeTokenWindow(loadLocalTokenUsage(usageOwnerId));

      if (windowData.tokensUsed + tokenCount > tokenLimit) {
        setSyncStatus(`${tokenLimit.toLocaleString()} token weekly limit reached`);
        setTokenUsage(windowData);
        return false;
      }

      const nextUsage = {
        windowStartedAt: windowData.windowStartedAt,
        tokensUsed: windowData.tokensUsed + tokenCount,
      };
      localStorage.setItem(tokenUsageStorageKey(usageOwnerId), JSON.stringify(nextUsage));
      setTokenUsage(nextUsage);
      return true;
    }

    const { data, error } = await supabase
      .from("token_usage_windows")
      .select("window_started_at,tokens_used")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      setSyncStatus(friendlySchemaStatus(error, "Could not check the token limit."));
      return false;
    }

    const currentWindow =
      data &&
      Date.now() - new Date(data.window_started_at).getTime() <= usageWindowMs
        ? data
        : { window_started_at: startedFallback, tokens_used: 0 };

    if (currentWindow.tokens_used + tokenCount > tokenLimit) {
      setSyncStatus(`${tokenLimit.toLocaleString()} token weekly limit reached`);
      setTokenUsage(
        normalizeTokenWindow({
          windowStartedAt: currentWindow.window_started_at,
          tokensUsed: currentWindow.tokens_used,
        }),
      );
      return false;
    }

    const nextUsage = {
      windowStartedAt: currentWindow.window_started_at,
      tokensUsed: currentWindow.tokens_used + tokenCount,
    };

    const { error: usageError } = await supabase.from("token_usage_windows").upsert({
      user_id: userId,
      window_started_at: nextUsage.windowStartedAt,
      tokens_used: nextUsage.tokensUsed,
      updated_at: startedFallback,
    });
    if (usageError) {
      setSyncStatus(friendlySchemaStatus(usageError, "Could not save token usage."));
      return false;
    }
    setTokenUsage(nextUsage);
    return true;
  }

  async function newChat() {
    await createChatSession();
  }

  function startRenameChat(session: ChatSession) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  async function saveRenameChat() {
    const nextTitle = editingTitle.trim().slice(0, 80);
    const session = sessions.find((item) => item.id === editingSessionId);
    if (!session || !nextTitle) {
      setEditingSessionId("");
      setEditingTitle("");
      return;
    }

    const updatedSession = {
      ...session,
      title: nextTitle,
      updatedAt: now(),
    };

    setSessions((current) => upsertSession(current, updatedSession));
    setEditingSessionId("");
    setEditingTitle("");
    queueSessionSync(updatedSession);
  }

  async function deleteChat(sessionId: string) {
    setDeleteSessionId("");
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    if (activeId === sessionId) {
      setActiveId(nextSessions[0]?.id);
    }

    if (supabase && userId && !isDemoElite && isUuid(sessionId)) {
      const { error } = await supabase.from("chat_sessions").delete().eq("id", sessionId);
      if (error) {
        setSyncStatus(friendlySchemaStatus(error, "Could not delete the chat."));
      }
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    let session: ChatSession | null | undefined = activeSession;
    if (!session) {
      session = await createChatSession(trimmed.slice(0, 46) || "ReformOne chat");
    }

    if (!session) {
      return;
    }

    const estimated = estimateTokens(trimmed) + 280;
    const allowed = await registerTokenUsage(estimated);
    if (!allowed) {
      return;
    }

    const timestamp = now();
    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: timestamp,
    };
    const sessionWithUserMessage: ChatSession = {
      ...session,
      title:
        session.title === "New chat"
          ? trimmed.slice(0, 46) || "ReformOne chat"
          : session.title,
      updatedAt: timestamp,
      messages: [...session.messages, userMessage],
    };

    setSessions((current) => upsertSession(current, sessionWithUserMessage));
    setActiveId(sessionWithUserMessage.id);
    setInput("");
    queueSessionSync(sessionWithUserMessage);

    const modelPrompt =
      memoryEnabled
        ? formatChatMemory(session.messages, trimmed, memoryCount)
        : trimmed;
    const reply = await generatePurcarReply(modelPrompt, {
      creativity,
      temperature,
      topK,
      repetitionPenalty,
    });
    const assistantMessage: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: reply,
      createdAt: now(),
    };
    const updatedSession: ChatSession = {
      ...sessionWithUserMessage,
      updatedAt: now(),
      messages: [...sessionWithUserMessage.messages, assistantMessage],
    };

    setSessions((current) => upsertSession(current, updatedSession));
    setActiveId(updatedSession.id);
    queueSessionSync(updatedSession);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    const email = authEmail.trim();

    if (demoElitePassword && email === demoEliteEmail && authPassword === demoElitePassword) {
      setUserId("demo-elite");
      setProfile({
        id: "demo-elite",
        email: demoEliteEmail,
        username: demoEliteUsername,
        display_name: "The Orange Juice",
        role: "student",
        plan: "elite",
        creativity: localCreativity,
        top_k: localTopK,
        repetition_penalty: localRepetitionPenalty,
        email_verified: true,
      });
      setSessions([]);
      setActiveId(undefined);
      setAuthOpen(false);
      setSyncStatus("Demo Elite full access");
      return;
    }

    if (!supabase) {
      setAuthError("Supabase is not configured. Fill .env.local and restart the server.");
      return;
    }

    const credentials = {
      email,
      password: authPassword,
    };
    const username =
      normalizeUsername(authUsername) || normalizeUsername(authEmail.split("@")[0]);
    const redirectTo = `${window.location.origin}/auth/callback`;

    const result =
      authMode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({
            ...credentials,
            options: {
              emailRedirectTo: redirectTo,
              data: {
                display_name: authName.trim() || username,
                username,
                purcar_email_verified: false,
              },
            },
          });

    if (result.error) {
      setAuthError(friendlyAuthError(result.error));
      return;
    }

    if (result.data.user) {
      await ensureProfile(result.data.user);
      await supabase.from("app_audit_logs").insert({
        actor_id: result.data.user.id,
        event: authMode === "signin" ? "auth.sign_in" : "auth.sign_up",
        metadata: { surface: "purcar" },
      });
    }

    setAuthOpen(false);
    setAuthPassword("");
    setSyncStatus(
      authMode === "signup"
        ? result.data.session
          ? "Account created. You are signed in."
          : "Account created. Email verification is optional but unlocks 50,000 extra weekly tokens."
        : "Cloud sync active",
    );
  }

  async function sendMagicLink(targetEmail = authEmail) {
    setAuthError("");
    const email = targetEmail.trim();
    if (!supabase || !email) {
      setAuthError("Enter your email for the magic link.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setAuthError(error ? friendlyAuthError(error) : "Magic link sent by email.");
  }

  async function sendVerificationLink() {
    setSyncStatus("");
    const email = profile?.email?.trim();
    if (!supabase || !email) {
      setSyncStatus("A valid account email is required.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=verify-email`,
        shouldCreateUser: false,
      },
    });

    setSyncStatus(
      error ? friendlyAuthError(error) : "Verification link sent by email.",
    );
  }

  async function sendPasswordReset(targetEmail = authEmail) {
    setAuthError("");
    const email = targetEmail.trim();
    if (!supabase || !email) {
      setAuthError("Enter your email for password reset.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=reset-password`,
    });

    setAuthError(error ? friendlyAuthError(error) : "Password reset link sent by email.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    const guestSessions = loadLocalSessions(null);
    setUserId(null);
    setProfile(null);
    setSessions(guestSessions);
    setActiveId(guestSessions[0]?.id);
    setTokenUsage(loadLocalTokenUsage(null));
    setCloudSaveState("local");
    setSettingsOpen(false);
    setSyncStatus("Sign in for saved chats");
  }

  function openSettings() {
    setSettingsName(profile?.display_name || "");
    setSettingsUsername(profile?.username || "");
    setSettingsOpen(true);
  }

  async function saveProfileSettings() {
    if (!profile) {
      return;
    }

    const nextProfile = {
      ...profile,
      display_name: settingsName.trim() || profile.display_name,
      username: normalizeUsername(settingsUsername) || profile.username,
    };
    setProfile(nextProfile);

    if (!supabase || isDemoElite) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: nextProfile.display_name,
        username: nextProfile.username,
      })
      .eq("id", profile.id);

    setSyncStatus(
      error ? friendlySchemaStatus(error, "Profile was not saved.") : "Profile saved",
    );
  }

  async function saveCreativity(nextValue: number) {
    const bounded = Math.min(100, Math.max(0, nextValue));
    setLocalCreativity(bounded);

    if (!supabase || !profile || isDemoElite) {
      if (profile) {
        setProfile({ ...profile, creativity: bounded });
      }
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ creativity: bounded })
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, creativity: bounded });
      setSyncStatus("Settings saved");
    } else {
      setSyncStatus(friendlySchemaStatus(error, "Settings could not be saved."));
    }
  }

  async function saveTemperature(nextValue: number) {
    const bounded = clampTemperature(nextValue);
    setLocalTemperature(bounded);

    if (supabase && profile && !isDemoElite) {
      await supabase.from("profiles").update({ temperature: bounded }).eq("id", profile.id);
    }

    setSyncStatus(
      bounded > 1.5
        ? "High temperature: answers can become more random."
        : "Temperature saved locally",
    );
  }

  async function saveTopK(nextValue: number) {
    const bounded = clampTopK(nextValue);
    setLocalTopK(bounded);

    if (supabase && profile && !isDemoElite && cloudSchemaReady.current === true) {
      const { error } = await supabase
        .from("profiles")
        .update({ top_k: bounded })
        .eq("id", profile.id);
      if (error) {
        setSyncStatus("Top K saved on this device.");
        return;
      }
    }

    setSyncStatus("Top K saved");
  }

  async function saveRepetitionPenalty(nextValue: number) {
    const bounded = clampRepetitionPenalty(nextValue);
    setLocalRepetitionPenalty(bounded);

    if (supabase && profile && !isDemoElite && cloudSchemaReady.current === true) {
      const { error } = await supabase
        .from("profiles")
        .update({ repetition_penalty: bounded })
        .eq("id", profile.id);
      if (error) {
        setSyncStatus("Repetition penalty saved on this device.");
        return;
      }
    }

    setSyncStatus("Repetition penalty saved");
  }

  async function updatePassword() {
    setPasswordStatus("");
    if (!supabase || !profile?.email) {
      setPasswordStatus("You must be signed in with a Supabase account.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus("The new password must have at least 6 characters.");
      return;
    }

    if (currentPassword) {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (reauthError) {
        setPasswordStatus(friendlyAuthError(reauthError));
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordStatus(friendlyAuthError(error));
      return;
    }

    await supabase.auth.signOut();
    setPasswordOpen(false);
    setSettingsOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setUserId(null);
    setProfile(null);
    setSessions([]);
    setActiveId(undefined);
    setAuthOpen(true);
    setAuthError("Password changed. Sign in again.");
  }

  return (
    <main
      className={[
        "zai-shell",
        "zai-shell--workspace",
        sidebarCollapsed ? "zai-shell--collapsed" : "",
      ].join(" ")}
    >
      <aside className="zai-sidebar">
        <a className="zai-sidebar__brand" href="/">
          PURCAR
          <span>Thanatos 0.1</span>
        </a>
        <button
          className="zai-sidebar-toggle"
          onClick={() => setSidebarCollapsed((value) => !value)}
          type="button"
          title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button
          className="zai-new-chat"
          onClick={newChat}
          type="button"
          title={!isAuthenticated ? "Temporary guest chat" : "New chat"}
        >
          <Plus size={16} />
          <span>New chat</span>
        </button>
        <div className="zai-chat-list">
          {!isAuthenticated && (
            <div className="zai-chat-empty">
              <UserCircle size={18} />
              <span>Guest chats stay on this device. Sign in to sync them.</span>
            </div>
          )}
          {isAuthenticated && !sessions.length && (
            <div className="zai-chat-empty">
              <MessageSquare size={18} />
              <span>No conversations yet.</span>
            </div>
          )}
          {sessions.map((session) => (
            <div
              className={session.id === activeSession?.id ? "is-active" : undefined}
              key={session.id}
            >
              <button onClick={() => setActiveId(session.id)} type="button">
                <MessageSquare size={15} />
                <span>{session.title}</span>
              </button>
              <div className="zai-chat-actions">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    startRenameChat(session);
                  }}
                  title="Rename chat"
                  type="button"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteSessionId(session.id);
                  }}
                  title="Delete chat"
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="zai-sidebar__links">
          <a href="/support">
            <LifeBuoy size={15} />
            <span>Support inbox</span>
          </a>
          {isAdmin && (
            <a href="/admin/support">
              <ShieldCheck size={15} />
              <span>Admin support</span>
            </a>
          )}
        </div>
      </aside>

      <section className="zai-workspace">
        <header className="zai-header zai-header--workspace">
          <div className="zai-model-switcher">
            <button className="zai-model" type="button">
              PURCAR Thanatos 0.1
              <ChevronDown size={15} />
            </button>
            <div className="zai-model-menu">
              <button type="button">
                <strong>Thanatos 0.1</strong>
                <span>The newest model</span>
              </button>
            </div>
          </div>
          <div className="zai-header__links">
            <a href="/support">Support -&gt;</a>
            {isAdmin && <span className="zai-sync-pill">{syncStatus}</span>}
            {profile ? (
              <>
                <button onClick={openSettings} type="button">
                  <span className="zai-avatar zai-avatar--small">{avatarText}</span>
                  <span>{profile.username ? `@${profile.username}` : profile.email || "Account"}</span>
                </button>
                <button onClick={signOut} type="button" title="Sign out">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <>
                <button onClick={openSettings} type="button" title="Chat settings">
                  <Settings2 size={15} />
                </button>
                <button onClick={() => setAuthOpen(true)} type="button">
                  <LogIn size={15} />
                  Sign in
                </button>
              </>
            )}
          </div>
        </header>

        <section className={`zai-center ${conversationStarted ? "zai-center--chat" : ""}`}>
          {!conversationStarted && (
            <div className="zai-intro">
              <h1>Hi, I'm PURCAR</h1>
              <p>
                {isAuthenticated
                  ? "Start a chat and explore education, research, and AI."
                  : "Chat freely without an account. History stays on this device until you sign in."}
              </p>
              {!isAuthenticated && (
                <button className="zai-primary-action zai-auth-gate" onClick={() => setAuthOpen(true)} type="button">
                  <LogIn size={16} />
                  Sign in to save chats
                </button>
              )}
            </div>
          )}

          {conversationStarted && activeSession && (
            <div className="zai-thread" ref={feedRef}>
              {visibleMessages.map((message) => (
                <article className={`zai-message zai-message--${message.role}`} key={message.id}>
                  <span>{message.role === "assistant" ? "PURCAR" : "You"}</span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          )}

          <div className={!isAuthenticated ? "zai-composer zai-composer--guest" : "zai-composer"}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={
                isAuthenticated
                  ? "How can I help you today?"
                  : "Guest chat. Write here..."
              }
            />
            <div className="zai-composer__bar">
              <div
                aria-label={tokenTitle}
                className="zai-token-orb"
                role="button"
                style={{ "--token-fill": `${tokenPercent}%` } as CSSProperties}
                tabIndex={0}
                title={tokenTitle}
              >
                <span>{Number.isFinite(tokensLeft) ? Math.ceil(tokensLeft / 1000) : "inf"}</span>
                <small>{Number.isFinite(tokensLeft) ? `${tokensLeft} tokens left` : "Unlimited tokens"}</small>
              </div>
              <div className={`zai-save-state zai-save-state--${cloudSaveState}`} title={syncStatus}>
                <Save size={15} />
                <span>{saveStateLabel}</span>
              </div>
              <button
                disabled={!input.trim()}
                className="zai-send"
                onClick={() => void sendMessage()}
                type="button"
                title="Send"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

        </section>
      </section>

      {authOpen && (
        <div className="zai-modal" role="dialog" aria-modal="true">
          <form className="zai-auth-card" onSubmit={submitAuth}>
            <header>
              <strong>{authMode === "signin" ? "Sign in" : "Create account"}</strong>
              <button onClick={() => setAuthOpen(false)} type="button">
                x
              </button>
            </header>
            {!isSupabaseConfigured && (
              <p className="zai-warning">
                Supabase is not configured. Put the values in `.env.local`, then restart
                the dev server.
              </p>
            )}
            {authMode === "signup" && (
              <>
                <label>
                  Name
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={authUsername}
                    onChange={(event) => setAuthUsername(event.target.value)}
                    placeholder="your_username"
                    required
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="email@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            {authError && <p className="zai-warning">{authError}</p>}
            <button className="zai-primary-action" type="submit">
              {authMode === "signin" ? "Sign in" : "Create account"}
            </button>
            <div className="zai-auth-secondary">
              <button onClick={() => void sendMagicLink()} type="button">
                Magic link
              </button>
              <button onClick={() => void sendPasswordReset()} type="button">
                Reset password
              </button>
            </div>
            <button
              className="zai-link-action"
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthError("");
              }}
              type="button"
            >
              {authMode === "signin"
                ? "No account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      )}

      {settingsOpen && (
        <div className="zai-modal" role="dialog" aria-modal="true">
          <section className="zai-auth-card zai-settings-card">
            <header>
              <strong>{profile ? "Account settings" : "Chat settings"}</strong>
              <button onClick={() => setSettingsOpen(false)} type="button">
                x
              </button>
            </header>
            {profile && (
              <div className="zai-account-row">
                <span className="zai-avatar">{avatarText}</span>
                <div>
                  <strong>{profile.display_name || "Student"}</strong>
                  <span>
                    {profile.username ? `@${profile.username}` : "missing username"} |{" "}
                    {profile.email || "local account"} | plan {profile.plan || "free"}
                  </span>
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="zai-admin-badge">
                <ShieldCheck size={16} />
                Admin: you can edit the presentation and reply to support.
              </div>
            )}
            {profile && (
              <div
                className={[
                  "zai-verification-badge",
                  profile.email_verified ? "is-verified" : "is-unverified",
                ].join(" ")}
              >
                {profile.email_verified ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                <div>
                  <strong>{profile.email_verified ? "Verified account" : "Not verified"}</strong>
                  <span>
                    {profile.email_verified
                      ? "150,000 tokens per week"
                      : "100,000 tokens per week. Verify email for 50,000 more."}
                  </span>
                </div>
                {!profile.email_verified && (
                  <button
                    className="zai-inline-verify"
                    onClick={() => void sendVerificationLink()}
                    type="button"
                  >
                    Verify email
                  </button>
                )}
              </div>
            )}
            {profile && (
              <>
                <label>
                  Display name
                  <input
                    value={settingsName}
                    onChange={(event) => setSettingsName(event.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Username
                  <input
                    value={settingsUsername}
                    onChange={(event) => setSettingsUsername(event.target.value)}
                    placeholder="username"
                  />
                </label>
                <button className="zai-primary-action" onClick={saveProfileSettings} type="button">
                  Save profile
                </button>
                <div className="zai-auth-secondary">
                  <button onClick={() => void sendMagicLink(profile.email || "")} type="button">
                    Magic link
                  </button>
                  <button onClick={() => void sendPasswordReset(profile.email || "")} type="button">
                    Reset password
                  </button>
                </div>
                <button className="zai-secondary-action" onClick={() => setPasswordOpen(true)} type="button">
                  Change password
                </button>
              </>
            )}
            <label className="zai-range-label">
              Thanatos temperature
              <span>{temperature} | allowed 0.01 - 1000</span>
              <input
                max={1000}
                min={0.01}
                step={0.01}
                type="number"
                value={temperature}
                onChange={(event) => void saveTemperature(Number(event.target.value))}
                onBlur={(event) => void saveTemperature(Number(event.target.value))}
              />
            </label>
            {temperature > 1.5 && (
              <p className="zai-warning zai-warning--inline">
                <AlertTriangle size={15} />
                Above temperature 1.5, answers can get too random and should be verified.
              </p>
            )}
            <label className="zai-range-label">
              Top K
              <span>{topK} candidate tokens</span>
              <input
                max={50_000}
                min={1}
                step={1}
                type="number"
                value={topK}
                onChange={(event) => void saveTopK(Number(event.target.value))}
                onBlur={(event) => void saveTopK(Number(event.target.value))}
              />
            </label>
            <label className="zai-range-label">
              Repetition penalty
              <span>{repetitionPenalty} | 1 disables the penalty</span>
              <input
                max={4}
                min={1}
                step={0.01}
                type="number"
                value={repetitionPenalty}
                onChange={(event) =>
                  void saveRepetitionPenalty(Number(event.target.value))
                }
                onBlur={(event) =>
                  void saveRepetitionPenalty(Number(event.target.value))
                }
              />
            </label>
            <div className="zai-beta-settings">
              <div>
                <strong>Conversation memory</strong>
                <span>Include recent messages when generating the next answer.</span>
              </div>
              <label className="zai-toggle-row">
                <input
                  checked={memoryEnabled}
                  onChange={(event) => setMemoryEnabled(event.target.checked)}
                  type="checkbox"
                />
                Memory {memoryEnabled ? "on" : "off"}
              </label>
              <label className="zai-range-label">
                Messages to remember
                <span>{memoryCount} latest messages</span>
                <input
                  disabled={!memoryEnabled}
                  max={200}
                  min={1}
                  step={1}
                  type="number"
                  value={memoryCount}
                  onChange={(event) =>
                    setMemoryCount(
                      Math.min(200, Math.max(1, Math.round(Number(event.target.value) || 1))),
                    )
                  }
                />
              </label>
            </div>
            <p className="zai-settings-note">
              Guests receive 25,000 tokens per week. Signed-in users receive 100,000,
              verified users receive 150,000, and admins keep unlimited access.
            </p>
          </section>
        </div>
      )}

      {passwordOpen && (
        <div className="zai-modal" role="dialog" aria-modal="true">
          <section className="zai-auth-card">
            <header>
              <strong>Change password</strong>
              <button onClick={() => setPasswordOpen(false)} type="button">
                x
              </button>
            </header>
            <p className="zai-settings-note">
              For a manual change, enter the current password. If you came from a reset
              link, you can fill only the new password.
            </p>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Optional for reset link"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                placeholder="Minimum 6 characters"
              />
            </label>
            {passwordStatus && <p className="zai-warning">{passwordStatus}</p>}
            <button className="zai-primary-action" onClick={updatePassword} type="button">
              Update password and sign out
            </button>
          </section>
        </div>
      )}

      {editingSessionId && (
        <div className="zai-modal" role="dialog" aria-modal="true">
          <section className="zai-auth-card">
            <header>
              <strong>Rename chat</strong>
              <button onClick={() => setEditingSessionId("")} type="button">
                x
              </button>
            </header>
            <label>
              Chat name
              <input
                autoFocus
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void saveRenameChat();
                  }
                }}
              />
            </label>
            <button className="zai-primary-action" onClick={saveRenameChat} type="button">
              Save
            </button>
          </section>
        </div>
      )}

      {deleteSessionId && (
        <div className="zai-modal" role="dialog" aria-modal="true">
          <section className="zai-auth-card">
            <header>
              <strong>Delete chat?</strong>
              <button onClick={() => setDeleteSessionId("")} type="button">
                x
              </button>
            </header>
            <p className="zai-settings-note">
              This conversation will be deleted from your account. This action cannot be undone.
            </p>
            <div className="zai-confirm-row">
              <button className="zai-secondary-action" onClick={() => setDeleteSessionId("")} type="button">
                Cancel
              </button>
              <button className="zai-danger-action" onClick={() => void deleteChat(deleteSessionId)} type="button">
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
