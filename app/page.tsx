"use client";

import { useState, useEffect, useRef } from "react";
import { RoomPreset, AgentProfile, DebateMessage, Verdict, ProviderConfig } from "@/lib/types";
import { toPng } from "html-to-image";

// Agent accent colors mapped by agent id (exactly per design spec)
const AGENT_ACCENTS: Record<string, string> = {
  "pakcik-roslan": "#8C6A4F",
  "gen-z-kl-creative": "#E0789A",
  "indian-teacher-ipoh": "#4F8C7A",
  "chinese-business-owner-penang": "#C9A227",
  "young-mother-shah-alam": "#7E9CD8",
  "tech-bro-cyberjaya": "#5BC0BE",
  "uncle-stephen-ranau": "#6B8E4E",
  "auntie-mei-lin-klang": "#B5651D",
  "rahim-construction-worker": "#A78BFA",
  "twitter-skeptic": "#C0C0C0",
  "vc-investor": "#E8B86D",
  "skeptical-engineer": "#6E9ECF"
};

// Helper to get agent accent color with fallback to brass/gold
const getAgentColor = (id: string) => AGENT_ACCENTS[id] || "#D4A24E";

// Premium pre-baked example ideas for quick testing
const EXAMPLE_IDEAS = [
  {
    id: "meals",
    room: "malaysian-society",
    title: "KL Auntie Meals Delivery",
    text: "A subscription app that delivers home-cooked lunch boxes prepared by local aunties and uncles to office workers in central KL. Priced at RM 15-20 per meal, emphasizing authentic taste, low oil, and supporting elderly cooks."
  },
  {
    id: "workweek",
    room: "malaysian-society",
    title: "4-Day Work Week Mandate",
    text: "Legislation to mandate a 4-day (32-hour) work week for all corporate and public sector workers in Malaysia with no reduction in pay, aimed at reducing burnout and promoting work-life balance."
  },
  {
    id: "snapchat-z",
    room: "gen-z-internet",
    title: "VibeCheck: Disappearing Social",
    text: "A new social platform where posts only last 5 minutes. If a post doesn't get at least 10 'Vibe Checks' (likes) in that window, the user's account is temporarily muted for 30 minutes to reduce feed clutter."
  },
  {
    id: "ai-vc",
    room: "silicon-valley",
    title: "AI-Run Venture Fund",
    text: "A seed-stage venture capital fund managed entirely by an LLM agent. It scrapes GitHub, ProductHunt, and Twitter/X to identify trending technologies, auto-drafts investment contracts, and sends funding in USDC."
  },
  {
    id: "meetings",
    room: "silicon-valley",
    title: "AI Meeting Replacer",
    text: "An enterprise AI agent that joins corporate Zoom meetings on your behalf, speaks in your cloned voice, defends your project updates, and summarizes action items, so you never have to attend a meeting again."
  }
];

export default function Dashboard() {
  // App state
  const [apiKey, setApiKey] = useState("");
  const [rooms, setRooms] = useState<RoomPreset[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [ideaText, setIdeaText] = useState("");
  
  // Simulation states
  const [isDebating, setIsDebating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [displayedMessages, setDisplayedMessages] = useState<DebateMessage[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [isGeneratingVerdict, setIsGeneratingVerdict] = useState(false);

  // Streaming loop step tracking
  const [debateStep, setDebateStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  
  // UI helper states
  const [showKey, setShowKey] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Shareable features states
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exportingType, setExportingType] = useState<"verdict" | "transcript" | null>(null);

  // Settings & multi-provider configurations
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "nvidia",
    baseUrl: "",
    apiKey: "",
    modelName: "meta/llama-3.3-70b-instruct"
  });

  // Settings modal draft state
  const [tempProvider, setTempProvider] = useState<"nvidia" | "ollama" | "lm-studio" | "custom">("nvidia");
  const [tempBaseUrl, setTempBaseUrl] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");
  const [tempModelName, setTempModelName] = useState("");

  // Toast notifications state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Ref to automatically scroll the debate container
  const debateEndRef = useRef<HTMLDivElement>(null);

  // Fetch rooms and agents on load
  useEffect(() => {
    // Retrieve saved API key (legacy)
    const savedKey = localStorage.getItem("mirroroom_nvapi_key");
    if (savedKey) setApiKey(savedKey);

    // Retrieve saved Provider Config
    const savedConfigStr = localStorage.getItem("mirroroom_provider_config");
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        setProviderConfig(parsed);
        if (parsed.apiKey) {
          setApiKey(parsed.apiKey);
        }
      } catch (e) {
        console.error("Failed to parse saved provider config:", e);
      }
    } else if (savedKey) {
      setProviderConfig({
        provider: "nvidia",
        baseUrl: "",
        apiKey: savedKey,
        modelName: "meta/llama-3.3-70b-instruct"
      });
    }

    async function loadData() {
      try {
        setLoadingRooms(true);
        const [roomsRes, agentsRes] = await Promise.all([
          fetch("/api/rooms"),
          fetch("/api/agents")
        ]);

        if (!roomsRes.ok || !agentsRes.ok) {
          throw new Error("Failed to load presets or agents metadata.");
        }

        const roomsData = await roomsRes.json();
        const agentsData = await agentsRes.json();

        setRooms(roomsData.rooms || []);
        setAgents(agentsData.agents || []);
        
        // Check if there is a shared data parameter in URL
        const params = new URLSearchParams(window.location.search);
        const sharedDataStr = params.get("d");
        const historyId = params.get("h");

        if (sharedDataStr) {
          try {
            const decodedStr = decodeURIComponent(escape(atob(sharedDataStr)));
            const decoded = JSON.parse(decodedStr);
            if (decoded.ideaText && decoded.roomId && decoded.transcript && decoded.verdict) {
              setIdeaText(decoded.ideaText);
              setSelectedRoomId(decoded.roomId);
              setDisplayedMessages(decoded.transcript);
              setVerdict(decoded.verdict);
              setIsSharedMode(true);
              setIsHistoryView(false);
              setDebateStep(decoded.transcript.length);
              setTotalSteps(decoded.transcript.length);
            }
          } catch (e) {
            console.error("Failed to decode shared data", e);
            setError("Invalid shareable link or corrupted data.");
          }
        } else if (historyId) {
          try {
            const hRes = await fetch(`/api/history?id=${historyId}`);
            if (!hRes.ok) throw new Error("History record not found");
            const hData = await hRes.json();
            if (hData.success && hData.debate) {
              const d = hData.debate;
              setIdeaText(d.ideaText);
              setSelectedRoomId(d.roomId);
              setDisplayedMessages(d.transcript);
              setVerdict(d.verdict);
              setIsSharedMode(true);
              setIsHistoryView(true);
              setDebateStep(d.transcript.length);
              setTotalSteps(d.transcript.length);
            }
          } catch (e) {
            console.error("Failed to load historical record:", e);
            setError("Failed to load historical inquest record from database.");
          }
        } else {
          // Select first room by default
          if (roomsData.rooms && roomsData.rooms.length > 0) {
            setSelectedRoomId(roomsData.rooms[0].id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error initializing application data");
      } finally {
        setLoadingRooms(false);
      }
    }

    loadData();
  }, []);

  // Sync and save provider settings
  const handleSaveProviderConfig = (newConfig: ProviderConfig) => {
    setProviderConfig(newConfig);
    localStorage.setItem("mirroroom_provider_config", JSON.stringify(newConfig));
    if (newConfig.apiKey) {
      setApiKey(newConfig.apiKey);
      localStorage.setItem("mirroroom_nvapi_key", newConfig.apiKey);
    } else {
      setApiKey("");
      localStorage.removeItem("mirroroom_nvapi_key");
    }
    setShowSettingsModal(false);
    showToast("Settings applied successfully");
  };

  // Process settings modal apply action
  const handleSaveSettings = () => {
    let finalBaseUrl = tempBaseUrl;
    let finalModelName = tempModelName;

    if (tempProvider === "ollama") {
      if (!finalBaseUrl) finalBaseUrl = "http://localhost:11434/v1";
      if (!finalModelName) finalModelName = "llama3.1:70b";
    } else if (tempProvider === "lm-studio") {
      if (!finalBaseUrl) finalBaseUrl = "http://localhost:1234/v1";
    } else if (tempProvider === "nvidia") {
      if (!finalModelName) finalModelName = "meta/llama-3.3-70b-instruct";
    }

    handleSaveProviderConfig({
      provider: tempProvider,
      baseUrl: finalBaseUrl,
      apiKey: tempApiKey,
      modelName: finalModelName
    });
  };

  // Open configuration modal
  const openSettingsModal = () => {
    setTempProvider(providerConfig.provider);
    setTempBaseUrl(providerConfig.baseUrl || "");
    setTempApiKey(providerConfig.apiKey || "");
    setTempModelName(providerConfig.modelName || "");
    setShowSettingsModal(true);
  };

  // Clear all history
  const handleClearAllHistory = async () => {
    if (!confirm("Are you sure you want to permanently delete all dockets from local history? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch("/api/history?clear=true", { method: "DELETE" });
      if (res.ok) {
        showToast("Database history cleared");
        setShowSettingsModal(false);
      } else {
        alert("Failed to clear database history");
      }
    } catch (e) {
      console.error("Clear database failed:", e);
      alert("Error clearing history database");
    }
  };

  // Reset shared view state to start a new simulation
  const handleResetSharedMode = () => {
    window.history.replaceState({}, "", "/");
    setIsSharedMode(false);
    setIsHistoryView(false);
    setIdeaText("");
    setDisplayedMessages([]);
    setVerdict(null);
    setDebateStep(0);
    setTotalSteps(0);
    if (rooms && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
    }
  };

  // Copy plain-text summary format
  const handleCopySummary = () => {
    if (!verdict) return;
    const category = verdict.overallScore >= 70 ? "HIGH SUPPORT" : verdict.overallScore >= 40 ? "MIXED / POLARIZED" : "LOW APPEAL";
    const summaryText = `I ran my idea through MirrorRoom 🪞\n\n"${ideaText.trim()}"\n\nVerdict: ${verdict.overallScore}/100 — ${category}\n\n"${verdict.summary}"\n\nTry it: github.com/jrh4ck3r/mirroroom`;
    
    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Create base64 encoded URL and copy to clipboard
  const handleCopyShareLink = () => {
    if (!verdict) return;
    try {
      const payload = {
        ideaText,
        roomId: selectedRoomId,
        transcript: displayedMessages,
        verdict
      };
      const jsonStr = JSON.stringify(payload);
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?d=${base64}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error("Failed to generate share URL", e);
      setError("Failed to generate share URL.");
    }
  };

  // Export DOM content as PNG image file
  const handleExportImage = async (type: "verdict" | "transcript") => {
    const elementId = type === "verdict" ? "export-verdict-only" : "export-full-transcript";
    const element = document.getElementById(elementId);
    if (!element) {
      setError("Export template element not found in DOM.");
      return;
    }

    setExportingType(type);
    try {
      // Small delay to ensure render complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#16181A",
        style: {
          transform: "none",
          margin: "0",
        },
      });

      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.download = `mirroroom-${type}-${timestamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export image failed", err);
      setError(err instanceof Error ? err.message : "Failed to generate PNG image.");
    } finally {
      setExportingType(null);
    }
  };

  // Update localStorage when API key changes
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem("mirroroom_nvapi_key", val);
  };

  // Scroll to bottom of debate stream
  useEffect(() => {
    if (debateEndRef.current) {
      debateEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayedMessages, activeAgentId]);

  // Resolve current room and its panelists
  const currentRoom = rooms.find(r => r.id === selectedRoomId);
  const currentRoomAgents = currentRoom
    ? currentRoom.agent_ids.map(id => agents.find(a => a.id === id)).filter(Boolean) as AgentProfile[]
    : [];

  // Populate example idea
  const selectExample = (ex: typeof EXAMPLE_IDEAS[0]) => {
    setIdeaText(ex.text);
    setSelectedRoomId(ex.room);
  };

  // Run the sequential focus group simulation step-by-step
  const handleRunSimulation = async () => {
    if (!apiKey && (providerConfig.provider === "nvidia" || providerConfig.provider === "custom")) {
      setError("Please configure your API Key in Settings first.");
      return;
    }
    if (!ideaText.trim()) {
      setError("Please describe the idea or policy to debate.");
      return;
    }

    setError(null);
    setVerdict(null);
    setDisplayedMessages([]);
    setIsDebating(true);
    setStatusText("Convening focus group panel...");
    setActiveAgentId(null);

    // Resolve room agents
    const currentRoom = rooms.find(r => r.id === selectedRoomId);
    if (!currentRoom) {
      setError("Selected room preset not found.");
      setIsDebating(false);
      return;
    }

    const roomAgentIds = currentRoom.agent_ids;
    setTotalSteps(roomAgentIds.length);
    setDebateStep(0);

    const accumulatedTranscript: DebateMessage[] = [];

    try {
      // Loop sequentially through each agent in the panel
      for (let i = 0; i < roomAgentIds.length; i++) {
        const agentId = roomAgentIds[i];
        const agent = agents.find(a => a.id === agentId);
        const name = agent ? agent.name : "Panelist";

        // Show active agent indicator
        setActiveAgentId(agentId);
        setStatusText(`${name} is deliberating...`);

        // Post request for the specific agent step
        const res = await fetch("/api/debate/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            providerConfig,
            ideaText,
            agentId,
            priorMessages: accumulatedTranscript,
            round: 1
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error generating response for ${name} (HTTP ${res.status})`);
        }

        const msg: DebateMessage = data.message;
        
        // Add to transcript for downstream agent context
        accumulatedTranscript.push(msg);

        // Update UI transcript and counter
        setDisplayedMessages(prev => [...prev, msg]);
        setDebateStep(i + 1);
      }

      // Complete debate step loop
      setActiveAgentId(null);

      // Verify if we collected responses
      if (accumulatedTranscript.length === 0) {
        throw new Error("Simulation completed but no agent responses were received.");
      }

      // 2. Request Verdict analysis
      setIsGeneratingVerdict(true);
      setStatusText("Focus group complete. Synthesizing final verdict...");
      
      const verdictRes = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          providerConfig,
          ideaText,
          transcript: accumulatedTranscript.map(m => ({
            agentId: m.agentId,
            name: m.agentName,
            avatarEmoji: m.avatarEmoji,
            response: m.content
          }))
        })
      });
      
      const verdictData = await verdictRes.json();
      if (!verdictRes.ok) {
        throw new Error(verdictData.error || "Failed to generate summary verdict.");
      }
      
      setVerdict(verdictData.verdict);
      setStatusText("Simulation complete! Verdict rendered below.");

      // Auto-save to local SQLite history database
      try {
        const saveRes = await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ideaText,
            roomId: selectedRoomId,
            roomName: currentRoom?.name || selectedRoomId,
            transcript: accumulatedTranscript,
            verdict: verdictData.verdict
          })
        });
        if (saveRes.ok) {
          showToast("Saved to history");
        } else {
          console.error("Failed to auto-save debate to history database");
        }
      } catch (saveErr) {
        console.error("Error auto-saving debate history:", saveErr);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during the simulation");
      setActiveAgentId(null);
    } finally {
      setIsDebating(false);
      setIsGeneratingVerdict(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#16181A] text-[#ECE8E1] flex flex-col antialiased font-sans">
      
      {/* Top Bar Header */}
      <header className="border-b border-zinc-800 bg-[#1F2226]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪞</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-serif text-white flex items-center gap-2">
                MIRRORROOM <span className="text-[9px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/30 px-1.5 py-0.5 rounded-sm font-mono tracking-widest uppercase">TRIBUNAL RECORD</span>
              </h1>
              <p className="text-[10px] text-[#9A9A92] font-mono tracking-wider uppercase">Official Deliberation Index</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 font-mono text-xs text-[#9A9A92]">
            <a href="/history" className="hover:text-white transition-colors flex items-center gap-1.5">
              📂 DOCKET ARCHIVE
            </a>
            <span className="text-[#D4A24E]">•</span>
            <button 
              onClick={openSettingsModal} 
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              ⚙️ SETTINGS
            </button>
            {currentRoom && (
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-[#D4A24E]">•</span>
                <span>ROOM:</span>
                <span className="text-[#ECE8E1] font-semibold">{currentRoom.name.toUpperCase()}</span>
                <span className="text-[#D4A24E]">•</span>
                <span>PANELISTS:</span>
                <span className="text-[#ECE8E1] font-semibold">{currentRoomAgents.length}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSharedMode && (
        <div className="bg-[#D4A24E]/10 border-b border-[#D4A24E]/30 text-[#D4A24E] py-3 px-4 text-center text-sm font-mono flex flex-wrap items-center justify-center gap-3">
          <span>
            {isHistoryView 
              ? "🏛 VIEWING HISTORICAL INQUEST RECORD FROM ARCHIVES" 
              : "🪞 VIEWING A SHARED MIRRORROOM INQUEST RESULT"}
          </span>
          <div className="flex gap-2">
            {isHistoryView && (
              <a
                href="/history"
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-1 rounded-sm font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Back To Docket Archive
              </a>
            )}
            <button
              onClick={handleResetSharedMode}
              className="bg-[#D4A24E] hover:bg-[#ECE8E1] text-[#16181A] px-3.5 py-1 rounded-sm font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Start New Inquest
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Case Record Config Panel (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Active Engine Status Panel */}
          <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider flex items-center gap-2">
                ⚡ ACTIVE ENGINE STATUS
              </h2>
              <button
                onClick={openSettingsModal}
                disabled={isDebating || isSharedMode}
                className="text-xs text-[#D4A24E] hover:underline font-mono cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CONFIGURE
              </button>
            </div>
            
            <div className="bg-[#16181A] border border-zinc-850 p-4 rounded-lg text-xs font-mono space-y-2 text-[#9A9A92]">
              <div>
                PROVIDER: <span className="text-white font-bold">{providerConfig.provider.toUpperCase()}</span>
              </div>
              <div className="overflow-hidden text-ellipsis">
                ENDPOINT: <span className="text-[#ECE8E1] truncate block">{providerConfig.provider === "nvidia" ? "https://integrate.api.nvidia.com/v1" : providerConfig.baseUrl || "DEFAULT"}</span>
              </div>
              {providerConfig.provider !== "lm-studio" && (
                <div className="overflow-hidden text-ellipsis">
                  MODEL ID: <span className="text-[#ECE8E1] truncate block">{providerConfig.modelName || "DEFAULT"}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-[#9A9A92] leading-relaxed font-sans">
              To swap model hosts, switch to local model execution, or configure API key parameters, click the CONFIGURE button.
            </p>
          </div>

          {/* Preset Selector */}
          <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider">
              🏛 SELECT INQUEST PANEL
            </h2>
            
            {loadingRooms ? (
              <div className="flex items-center justify-center py-6 text-[#9A9A92] text-xs font-mono">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#D4A24E] mr-2" />
                LOADING CASE FILES...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => {
                      if (!isDebating && !isSharedMode) {
                        setSelectedRoomId(room.id);
                        setDisplayedMessages([]);
                        setVerdict(null);
                      }
                    }}
                    disabled={isDebating || isSharedMode}
                    id={`room-select-${room.id}`}
                    className={`text-left p-3.5 rounded-lg border text-sm transition-all flex flex-col gap-1.5 ${
                      selectedRoomId === room.id
                        ? "bg-[#D4A24E]/5 border-[#D4A24E]/50 shadow-[0_0_15px_rgba(212,162,78,0.08)]"
                        : "bg-[#16181A]/60 border-zinc-800/80 hover:bg-[#16181A]/80 hover:border-zinc-700/60 cursor-pointer"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-semibold text-white font-serif">{room.name}</span>
                      <span className="text-[10px] bg-zinc-800 text-[#9A9A92] px-1.5 py-0.5 rounded-sm font-mono">
                        {room.agent_ids.length} MEMBERS
                      </span>
                    </div>
                    <p className="text-xs text-[#9A9A92] leading-relaxed font-sans">{room.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Concept/Idea Input */}
          <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider flex items-center justify-between">
              <span>📝 CONCEPT UNDER REVIEW</span>
            </h2>
            
            <textarea
              value={ideaText}
              id="idea-textarea"
              onChange={(e) => setIdeaText(e.target.value)}
              disabled={isDebating || isSharedMode}
              placeholder="e.g. A city mandate implementing a 4-day work week for corporate offices to increase mental health and productivity..."
              rows={5}
              className="w-full bg-[#16181A] border border-zinc-800/80 focus:border-[#D4A24E] focus:outline-hidden text-[#ECE8E1] rounded-lg p-3 text-sm leading-relaxed font-sans transition-colors resize-none disabled:opacity-50"
            />

            {/* Quick Presets */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-[#9A9A92] font-mono">PRE-LOAD TEST SCENARIOS:</span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_IDEAS.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => selectExample(ex)}
                    disabled={isDebating || isSharedMode}
                    className="text-[11px] px-2.5 py-1 rounded-sm border border-zinc-800 bg-[#16181A] text-[#9A9A92] hover:text-[#ECE8E1] hover:border-[#D4A24E]/50 transition-all cursor-pointer font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ex.title.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleRunSimulation}
              disabled={isDebating || !apiKey || !ideaText.trim() || isSharedMode}
              id="start-debate-btn"
              className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all text-center flex items-center justify-center gap-2 border font-mono tracking-widest ${
                isDebating
                  ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                  : !apiKey || !ideaText.trim() || isSharedMode
                  ? "bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-[#D4A24E] text-[#16181A] border-[#D4A24E] font-bold hover:bg-[#ECE8E1] hover:border-[#ECE8E1] cursor-pointer transition-colors shadow-md"
              }`}
            >
              {isDebating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#16181A]" />
                  CONVENING HEARINGS...
                </>
              ) : (
                <>
                  ⚖️ START DELIBERATION
                </>
              )}
            </button>

            {isSharedMode && (
              <p className="text-[11px] text-[#D4A24E] leading-relaxed font-sans text-center font-mono animate-pulse">
                Click "Run Your Own Inquest" in the top banner to unlock editing.
              </p>
            )}
          </div>

        </section>

        {/* Right Column: Centered Debate Transcript & Stamp Verdict (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6 max-w-[720px] mx-auto w-full">
          
          {/* Panelists Attendance Monitor */}
          <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
            <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider flex justify-between items-center">
              <span>🏛 BOARD OF INQUEST IN SESSION ({currentRoomAgents.length})</span>
              {isDebating && (
                <span className="text-[10px] text-[#D4A24E] font-bold animate-pulse font-mono tracking-widest">
                  LIVE DELIBERATIONS
                </span>
              )}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {currentRoomAgents.map((agent) => {
                const isSpeaking = activeAgentId === agent.id;
                const hasSpoken = displayedMessages.some(m => m.agentId === agent.id);
                const accentColor = getAgentColor(agent.id);
                
                let cardClass = "border-zinc-850 bg-[#16181A]/40 opacity-40";
                if (isSpeaking) {
                  cardClass = "border-[#D4A24E] bg-[#D4A24E]/5 shadow-[0_0_12px_rgba(212,162,78,0.05)] ring-1 ring-[#D4A24E]/25 animate-pulse-border";
                } else if (hasSpoken) {
                  cardClass = "border-emerald-900/40 bg-emerald-950/2 opacity-90";
                }

                return (
                  <div 
                    key={agent.id}
                    className={`p-3 border rounded-xl flex gap-2.5 transition-all duration-300 relative text-xs ${cardClass}`}
                  >
                    {/* Circle Avatar with custom agent color tint */}
                    <div 
                      className={`h-9 w-9 rounded-full flex items-center justify-center text-xl shrink-0 border border-zinc-800/30 ${isSpeaking ? "animate-bounce" : ""}`}
                      style={{ backgroundColor: `${accentColor}18` }}
                    >
                      {agent.avatar_emoji}
                    </div>

                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <div className="flex items-center gap-1.5 w-full justify-between">
                        <span className="font-semibold text-[#ECE8E1] truncate font-sans">{agent.name}</span>
                        {isSpeaking && (
                          <span className="flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#D4A24E]"></span>
                          </span>
                        )}
                        {hasSpoken && (
                          <span className="text-emerald-500 font-mono text-[9px] font-bold">✓</span>
                        )}
                      </div>
                      <span className="text-[9px] text-[#9A9A92] truncate font-mono tracking-wider uppercase font-semibold">
                        {agent.occupation.split(",")[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Debate Transcript Box */}
          {(displayedMessages.length > 0 || isDebating) && (
            <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col min-h-[400px]">
              
              {/* Header with Case Status */}
              <div className="flex flex-col gap-3 border-b border-zinc-800/80 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-[#9A9A92] font-mono tracking-wider uppercase">
                    📝 TRANSCRIPT OF TESTIMONIES
                  </h2>
                  <div className="flex items-center gap-2 text-[10px] text-[#9A9A92] font-mono uppercase">
                    {isDebating ? (
                      <span className="text-[#D4A24E] animate-pulse">{statusText}</span>
                    ) : (
                      <span className="text-zinc-500">PROCEEDINGS CONCLUDED</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 bg-[#16181A] border border-zinc-850 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-[#D4A24E] h-1.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(212,162,78,0.4)]" 
                      style={{ width: `${(debateStep / totalSteps) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#9A9A92] font-mono font-bold">
                    {debateStep} / {totalSteps} SEATS
                  </span>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 select-text">
                {displayedMessages.map((msg, index) => {
                  const agent = agents.find(a => a.id === msg.agentId);
                  const accentColor = getAgentColor(msg.agentId);
                  return (
                    <div
                      key={index}
                      className="animate-card-slide flex items-start gap-4 bg-[#16181A]/40 border border-zinc-850 p-4 rounded-r-xl transition-all duration-300"
                      style={{ borderLeft: `3px solid ${accentColor}` }}
                    >
                      {/* Avatar Circle with tinted background */}
                      <div 
                        className="h-10 w-10 rounded-full flex items-center justify-center text-xl shrink-0 border border-zinc-800/30"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        {msg.avatarEmoji}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                          <h3 className="text-sm font-semibold text-white font-sans">{msg.agentName}</h3>
                          <span className="text-[9px] text-[#9A9A92] font-mono uppercase tracking-wider font-semibold">
                            {agent?.occupation || "Panelist"} • {agent?.location.split(",")[0] || ""}
                          </span>
                        </div>
                        <p className="text-sm text-[#ECE8E1]/90 leading-relaxed font-sans font-light">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Live Typing Simulator */}
                {activeAgentId && (
                  <div 
                    className="flex items-start gap-4 bg-[#16181A]/60 border border-zinc-850 p-4 rounded-r-xl animate-card-slide"
                    style={{ borderLeft: `3px solid ${getAgentColor(activeAgentId)}` }}
                  >
                    <div 
                      className="h-10 w-10 rounded-full flex items-center justify-center text-xl shrink-0 border border-zinc-800/30 animate-pulse"
                      style={{ backgroundColor: `${getAgentColor(activeAgentId)}18` }}
                    >
                      {agents.find(a => a.id === activeAgentId)?.avatar_emoji || "👤"}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-white animate-pulse">
                          {agents.find(a => a.id === activeAgentId)?.name}
                        </h3>
                        <span className="text-[10px] text-[#D4A24E] font-mono tracking-widest uppercase">
                          RECORDING TESTIMONY...
                        </span>
                      </div>
                      <div className="py-2 flex items-center gap-1.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={debateEndRef} />
              </div>
            </div>
          )}

          {/* Verdict Summary Case File */}
          {(verdict || isGeneratingVerdict) && (
            <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-6 animate-card-slide">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h2 className="text-xs font-semibold text-[#9A9A92] font-mono tracking-wider uppercase">
                  📜 OFFICIAL TRIBUNAL VERDICT
                </h2>
                {isGeneratingVerdict && (
                  <span className="text-[10px] text-[#D4A24E] font-mono uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#D4A24E]" />
                    STAMPING FILE...
                  </span>
                )}
              </div>

              {verdict && (
                <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-4">
                  {/* Export Verdict Only PNG */}
                  <button
                    onClick={() => handleExportImage("verdict")}
                    disabled={exportingType !== null}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded bg-zinc-850 border border-zinc-800 text-[11px] font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingType === "verdict" ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        EXPORTING...
                      </>
                    ) : (
                      <>🖼️ DOWNLOAD VERDICT CARD (PNG)</>
                    )}
                  </button>

                  {/* Export Full Transcript PNG */}
                  <button
                    onClick={() => handleExportImage("transcript")}
                    disabled={exportingType !== null}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded bg-zinc-850 border border-zinc-800 text-[11px] font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingType === "transcript" ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        EXPORTING...
                      </>
                    ) : (
                      <>📜 DOWNLOAD FULL TRANSCRIPT (PNG)</>
                    )}
                  </button>

                  {/* Copy Summary Text */}
                  <button
                    onClick={handleCopySummary}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded bg-zinc-850 border border-zinc-800 text-[11px] font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {copiedText ? <>✓ COPIED SUMMARY!</> : <>📋 COPY SUMMARY TEXT</>}
                  </button>

                  {/* Copy Share Link */}
                  <button
                    onClick={handleCopyShareLink}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded bg-zinc-850 border border-zinc-800 text-[11px] font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {copiedLink ? <>✓ COPIED LINK!</> : <>🔗 COPY SHARE LINK</>}
                  </button>
                </div>
              )}

              {verdict && (
                <div className="space-y-6">
                  
                  {/* Signature Element: The Verdict Seal Stamp & Case Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    
                    {/* Rubber Stamp Seal container (rotated -6deg) */}
                    <div className="md:col-span-5 flex flex-col items-center justify-center text-center py-4">
                      <span className="font-serif text-sm font-medium text-[#D4A24E] tracking-wide mb-2">
                        Public Appeal
                      </span>
                      
                      {/* Double ring circular stamp */}
                      <div className="verdict-seal-stamp h-[140px] w-[140px] rounded-full border-4 border-double border-[#D4A24E] flex flex-col items-center justify-center select-none shadow-[inset_0_0_12px_rgba(212,162,78,0.1)] relative">
                        <div className="absolute inset-1 rounded-full border border-dashed border-[#D4A24E]/20" />
                        
                        <span className="text-4xl font-bold font-mono text-[#D4A24E] leading-none tracking-tight">
                          {verdict.overallScore}
                        </span>
                        
                        <span className="text-[10px] font-mono text-[#D4A24E]/80 tracking-widest mt-1">
                          / 100
                        </span>
                      </div>
                      
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4A24E] mt-3 font-bold">
                        {verdict.overallScore >= 70 ? "HIGH SUPPORT" : verdict.overallScore >= 40 ? "MIXED / POLARIZED" : "LOW APPEAL"}
                      </span>
                    </div>

                    {/* Summary Paragraph styled as Case File Index */}
                    <div className="md:col-span-7 bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-5 flex flex-col gap-2 shadow-xs">
                      <span className="text-[10px] text-[#D4A24E] font-mono uppercase tracking-widest font-semibold">
                        JUDGMENT SUMMARY
                      </span>
                      <p className="text-sm text-[#ECE8E1]/90 leading-relaxed font-sans italic">
                        "{verdict.summary}"
                      </p>
                    </div>

                  </div>

                  {/* Case File Sheets: Support & Concerns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Support card */}
                    <div className="bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-5 flex flex-col gap-3">
                      <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span>✓</span> DETAILED FINDINGS OF SUPPORT
                      </h3>
                      <ul className="space-y-2.5 text-xs text-[#ECE8E1]/80">
                        {verdict.topSupport.map((item, idx) => (
                          <li key={idx} className="flex gap-2 leading-relaxed">
                            <span className="text-emerald-500 select-none">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Concerns card */}
                    <div className="bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-5 flex flex-col gap-3">
                      <h3 className="text-[10px] font-bold text-rose-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span>⚠️</span> FORESEEN SYSTEMIC CONCERNS
                      </h3>
                      <ul className="space-y-2.5 text-xs text-[#ECE8E1]/80">
                        {verdict.topConcerns.map((item, idx) => (
                          <li key={idx} className="flex gap-2 leading-relaxed">
                            <span className="text-rose-500 select-none">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  {/* Polarizing Contentions Card */}
                  {verdict.mostPolarizingPair && (
                    <div className="bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-5 flex flex-col gap-3">
                      <span className="text-[10px] text-[#D4A24E] font-mono uppercase tracking-widest font-semibold">
                        PRIMARY COUNCIL DISSENSION
                      </span>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
                        {/* Agent 1 */}
                        <div className="flex items-center gap-2 bg-[#1F2226] px-3 py-2 rounded-lg border border-zinc-800/80 w-full sm:w-auto">
                          <span className="text-xl">
                            {agents.find(a => a.name === verdict.mostPolarizingPair.agent1)?.avatar_emoji || "👤"}
                          </span>
                          <span className="text-xs font-bold text-white whitespace-nowrap">
                            {verdict.mostPolarizingPair.agent1}
                          </span>
                        </div>

                        {/* VS symbol */}
                        <span className="text-[9px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/25 px-2 py-0.5 rounded-full font-mono font-bold">
                          VS
                        </span>

                        {/* Agent 2 */}
                        <div className="flex items-center gap-2 bg-[#1F2226] px-3 py-2 rounded-lg border border-zinc-800/80 w-full sm:w-auto">
                          <span className="text-xl">
                            {agents.find(a => a.name === verdict.mostPolarizingPair.agent2)?.avatar_emoji || "👤"}
                          </span>
                          <span className="text-xs font-bold text-white whitespace-nowrap">
                            {verdict.mostPolarizingPair.agent2}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#ECE8E1]/80 leading-relaxed font-sans">
                        <strong className="text-white">Diverging Positions:</strong> {verdict.mostPolarizingPair.reason}
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* General Error Log */}
          {error && (
            <div className="bg-[#1F2226] p-5 border border-rose-900/30 text-rose-400 rounded-xl flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-500 font-mono">⚠️ DEPOSITION ERROR</span>
              <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap">{error}</p>
            </div>
          )}

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#1F2226]/20 py-6 mt-12 text-center text-xs text-[#9A9A92]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono">
          <p>© {new Date().getFullYear()} MIRRORROOM. ALL TESTIMONIES ARCHIVED SECURELY.</p>
          <p>POWERED BY NVIDIA NIM DIRECT CONNECTIONS.</p>
        </div>
      </footer>

      {/* Hidden Export Templates for html-to-image */}
      {verdict && (
        <div className="absolute -left-[9999px] -top-[9999px] w-[1200px]" style={{ zIndex: -1 }}>
          
          {/* 1. Verdict Only Template */}
          <div 
            id="export-verdict-only" 
            className="bg-[#16181A] text-[#ECE8E1] p-16 flex flex-col gap-8 font-sans border-4 border-[#D4A24E]/20"
          >
            {/* Logo and Wordmark Header */}
            <div className="flex items-center justify-between border-b border-[#D4A24E]/30 pb-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🪞</span>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight font-serif text-white flex items-center gap-3">
                    MIRRORROOM <span className="text-xs bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/30 px-2.5 py-1 rounded-sm font-mono tracking-widest uppercase">TRIBUNAL RECORD</span>
                  </h1>
                  <p className="text-xs text-[#9A9A92] font-mono tracking-wider uppercase mt-1">Official Focus Group Deliberation Index</p>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-[#9A9A92] space-y-1">
                <div>ROOM / PANEL: <span className="text-white font-semibold">{currentRoom?.name.toUpperCase()}</span></div>
                <div>PANELISTS: <span className="text-white font-semibold">{currentRoomAgents.length} SEATS</span></div>
                <div>DATE: <span className="text-[#D4A24E] font-semibold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</span></div>
              </div>
            </div>

            {/* Concept Under Review */}
            <div className="bg-[#1F2226] border border-zinc-800 p-6 rounded-xl flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider border-b border-zinc-800 pb-2">
                📝 CONCEPT UNDER REVIEW
              </h2>
              <p className="text-base text-[#ECE8E1]/90 leading-relaxed font-sans italic font-light">
                "{ideaText}"
              </p>
            </div>

            {/* Verdict Seal & Summary */}
            <div className="grid grid-cols-12 gap-8 items-center bg-[#1F2226] border border-zinc-800 p-8 rounded-xl">
              
              {/* Verdict Seal Stamp */}
              <div className="col-span-4 flex flex-col items-center justify-center text-center">
                <span className="font-serif text-sm font-medium text-[#D4A24E] tracking-wide mb-3">
                  Public Appeal
                </span>
                
                <div className="h-[150px]. w-[150px] rounded-full border-4 border-double border-[#D4A24E] flex flex-col items-center justify-center select-none shadow-[inset_0_0_15px_rgba(212,162,78,0.1)] relative" style={{ transform: "rotate(-6deg)" }}>
                  <div className="absolute inset-1 rounded-full border border-dashed border-[#D4A24E]/20" />
                  <span className="text-5xl font-bold font-mono text-[#D4A24E] leading-none tracking-tight">
                    {verdict.overallScore}
                  </span>
                  <span className="text-xs font-mono text-[#D4A24E]/80 tracking-widest mt-1">
                    / 100
                  </span>
                </div>
                
                <span className="font-mono text-xs uppercase tracking-widest text-[#D4A24E] mt-4 font-bold">
                  {verdict.overallScore >= 70 ? "HIGH SUPPORT" : verdict.overallScore >= 40 ? "MIXED / POLARIZED" : "LOW APPEAL"}
                </span>
              </div>

              {/* Judgment Summary */}
              <div className="col-span-8 bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-3 h-full justify-center">
                <span className="text-xs text-[#D4A24E] font-mono uppercase tracking-widest font-semibold">
                  JUDGMENT SUMMARY
                </span>
                <p className="text-base text-[#ECE8E1]/90 leading-relaxed font-sans italic">
                  "{verdict.summary}"
                </p>
              </div>

            </div>

            {/* Findings Columns */}
            <div className="grid grid-cols-2 gap-8">
              
              {/* Support */}
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span>✓</span> DETAILED FINDINGS OF SUPPORT
                </h3>
                <ul className="space-y-3 text-sm text-[#ECE8E1]/80">
                  {verdict.topSupport.map((item, idx) => (
                    <li key={idx} className="flex gap-2.5 leading-relaxed">
                      <span className="text-emerald-500 select-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Concerns */}
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span>⚠️</span> FORESEEN SYSTEMIC CONCERNS
                </h3>
                <ul className="space-y-3 text-sm text-[#ECE8E1]/80">
                  {verdict.topConcerns.map((item, idx) => (
                    <li key={idx} className="flex gap-2.5 leading-relaxed">
                      <span className="text-rose-500 select-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Polarizing Contentions */}
            {verdict.mostPolarizingPair && (
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <span className="text-xs text-[#D4A24E] font-mono uppercase tracking-widest font-semibold border-b border-zinc-800 pb-2">
                  PRIMARY COUNCIL DISSENSION
                </span>
                
                <div className="flex items-center gap-6 py-1">
                  {/* Agent 1 */}
                  <div className="flex items-center gap-3 bg-[#16181A] px-4 py-2.5 rounded-lg border border-zinc-800">
                    <span className="text-2xl">
                      {agents.find(a => a.name === verdict.mostPolarizingPair.agent1)?.avatar_emoji || "👤"}
                    </span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {verdict.mostPolarizingPair.agent1}
                    </span>
                  </div>

                  <span className="text-[10px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/25 px-3 py-1 rounded-full font-mono font-bold">
                    VS
                  </span>

                  {/* Agent 2 */}
                  <div className="flex items-center gap-3 bg-[#16181A] px-4 py-2.5 rounded-lg border border-zinc-800">
                    <span className="text-2xl">
                      {agents.find(a => a.name === verdict.mostPolarizingPair.agent2)?.avatar_emoji || "👤"}
                    </span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {verdict.mostPolarizingPair.agent2}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[#ECE8E1]/80 leading-relaxed font-sans">
                  <strong className="text-white">Diverging Positions:</strong> {verdict.mostPolarizingPair.reason}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-zinc-800 pt-6 mt-4 flex justify-between items-center text-xs text-[#9A9A92] font-mono">
              <p>Generated with MirrorRoom (open source) — github.com/jrh4ck3r/mirroroom</p>
              <p>POWERED BY NVIDIA NIM DIRECT CONNECTIONS</p>
            </div>

          </div>

          {/* 2. Full Transcript Template */}
          <div 
            id="export-full-transcript" 
            className="bg-[#16181A] text-[#ECE8E1] p-16 flex flex-col gap-8 font-sans border-4 border-[#D4A24E]/20"
          >
            {/* Logo and Wordmark Header */}
            <div className="flex items-center justify-between border-b border-[#D4A24E]/30 pb-6">
              <div className="flex items-center gap-4">
                <span className="text-4xl">🪞</span>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight font-serif text-white flex items-center gap-3">
                    MIRRORROOM <span className="text-xs bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/30 px-2.5 py-1 rounded-sm font-mono tracking-widest uppercase">TRIBUNAL RECORD</span>
                  </h1>
                  <p className="text-xs text-[#9A9A92] font-mono tracking-wider uppercase mt-1">Complete Focus Group Debates & Final Scorecard</p>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-[#9A9A92] space-y-1">
                <div>ROOM / PANEL: <span className="text-white font-semibold">{currentRoom?.name.toUpperCase()}</span></div>
                <div>PANELISTS: <span className="text-white font-semibold">{currentRoomAgents.length} SEATS</span></div>
                <div>DATE: <span className="text-[#D4A24E] font-semibold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}</span></div>
              </div>
            </div>

            {/* Concept Under Review */}
            <div className="bg-[#1F2226] border border-zinc-800 p-6 rounded-xl flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider border-b border-zinc-800 pb-2">
                📝 CONCEPT UNDER REVIEW
              </h2>
              <p className="text-base text-[#ECE8E1]/90 leading-relaxed font-sans italic font-light">
                "{ideaText}"
              </p>
            </div>

            {/* Panelists testimonies */}
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider border-b border-zinc-800 pb-2">
                📜 RECORDED TESTIMONIES OF PANELISTS
              </h2>
              
              <div className="space-y-4">
                {displayedMessages.map((msg, index) => {
                  const agent = agents.find(a => a.id === msg.agentId);
                  const accentColor = getAgentColor(msg.agentId);
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-5 bg-[#1F2226] border border-zinc-800 p-5 rounded-r-xl"
                      style={{ borderLeft: `4px solid ${accentColor}` }}
                    >
                      <div 
                        className="h-12 w-12 rounded-full flex items-center justify-center text-2xl shrink-0 border border-zinc-800/30"
                        style={{ backgroundColor: `${accentColor}18` }}
                      >
                        {msg.avatarEmoji}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-base font-semibold text-white font-sans">{msg.agentName}</h3>
                          <span className="text-[10px] text-[#9A9A92] font-mono uppercase tracking-wider font-semibold">
                            {agent?.occupation || "Panelist"} • {agent?.location.split(",")[0] || ""}
                          </span>
                        </div>
                        <p className="text-sm text-[#ECE8E1]/90 leading-relaxed font-sans font-light">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verdict Seal & Summary */}
            <div className="grid grid-cols-12 gap-8 items-center bg-[#1F2226] border border-zinc-800 p-8 rounded-xl mt-4">
              
              {/* Verdict Seal Stamp */}
              <div className="col-span-4 flex flex-col items-center justify-center text-center">
                <span className="font-serif text-sm font-medium text-[#D4A24E] tracking-wide mb-3">
                  Public Appeal
                </span>
                
                <div className="h-[150px] w-[150px] rounded-full border-4 border-double border-[#D4A24E] flex flex-col items-center justify-center select-none shadow-[inset_0_0_15px_rgba(212,162,78,0.1)] relative" style={{ transform: "rotate(-6deg)" }}>
                  <div className="absolute inset-1 rounded-full border border-dashed border-[#D4A24E]/20" />
                  <span className="text-5xl font-bold font-mono text-[#D4A24E] leading-none tracking-tight">
                    {verdict.overallScore}
                  </span>
                  <span className="text-xs font-mono text-[#D4A24E]/80 tracking-widest mt-1">
                    / 100
                  </span>
                </div>
                
                <span className="font-mono text-xs uppercase tracking-widest text-[#D4A24E] mt-4 font-bold">
                  {verdict.overallScore >= 70 ? "HIGH SUPPORT" : verdict.overallScore >= 40 ? "MIXED / POLARIZED" : "LOW APPEAL"}
                </span>
              </div>

              {/* Judgment Summary */}
              <div className="col-span-8 bg-[#16181A] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-3 h-full justify-center">
                <span className="text-xs text-[#D4A24E] font-mono uppercase tracking-widest font-semibold">
                  JUDGMENT SUMMARY
                </span>
                <p className="text-base text-[#ECE8E1]/90 leading-relaxed font-sans italic">
                  "{verdict.summary}"
                </p>
              </div>

            </div>

            {/* Findings Columns */}
            <div className="grid grid-cols-2 gap-8">
              
              {/* Support */}
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-[#10B981] uppercase tracking-widest font-mono flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span>✓</span> DETAILED FINDINGS OF SUPPORT
                </h3>
                <ul className="space-y-3 text-sm text-[#ECE8E1]/80">
                  {verdict.topSupport.map((item, idx) => (
                    <li key={idx} className="flex gap-2.5 leading-relaxed">
                      <span className="text-[#10B981] select-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Concerns */}
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest font-mono flex items-center gap-2 border-b border-zinc-800 pb-2">
                  <span>⚠️</span> FORESEEN SYSTEMIC CONCERNS
                </h3>
                <ul className="space-y-3 text-sm text-[#ECE8E1]/80">
                  {verdict.topConcerns.map((item, idx) => (
                    <li key={idx} className="flex gap-2.5 leading-relaxed">
                      <span className="text-rose-500 select-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* Polarizing Contentions */}
            {verdict.mostPolarizingPair && (
              <div className="bg-[#1F2226] border-t-2 border-[#D4A24E] rounded-b-xl p-6 flex flex-col gap-4">
                <span className="text-xs text-[#D4A24E] font-mono uppercase tracking-widest font-semibold border-b border-zinc-800 pb-2">
                  PRIMARY COUNCIL DISSENSION
                </span>
                
                <div className="flex items-center gap-6 py-1">
                  {/* Agent 1 */}
                  <div className="flex items-center gap-3 bg-[#16181A] px-4 py-2.5 rounded-lg border border-zinc-800">
                    <span className="text-2xl">
                      {agents.find(a => a.name === verdict.mostPolarizingPair.agent1)?.avatar_emoji || "👤"}
                    </span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {verdict.mostPolarizingPair.agent1}
                    </span>
                  </div>

                  <span className="text-[10px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/25 px-3 py-1 rounded-full font-mono font-bold">
                    VS
                  </span>

                  {/* Agent 2 */}
                  <div className="flex items-center gap-3 bg-[#16181A] px-4 py-2.5 rounded-lg border border-zinc-800">
                    <span className="text-2xl">
                      {agents.find(a => a.name === verdict.mostPolarizingPair.agent2)?.avatar_emoji || "👤"}
                    </span>
                    <span className="text-sm font-bold text-white whitespace-nowrap">
                      {verdict.mostPolarizingPair.agent2}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-[#ECE8E1]/80 leading-relaxed font-sans">
                  <strong className="text-white">Diverging Positions:</strong> {verdict.mostPolarizingPair.reason}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-zinc-800 pt-6 mt-4 flex justify-between items-center text-xs text-[#9A9A92] font-mono">
              <p>Generated with MirrorRoom (open source) — github.com/jrh4ck3r/mirroroom</p>
              <p>POWERED BY NVIDIA NIM DIRECT CONNECTIONS</p>
            </div>

          </div>

        </div>
      )}
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1F2226] border border-zinc-800 rounded-xl p-6 max-w-md w-full flex flex-col gap-5 relative animate-card-slide">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-white font-serif tracking-wide flex items-center gap-2">
                ⚙️ SYSTEM CONFIGURATION
              </h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-[#9A9A92] hover:text-white font-mono text-xs cursor-pointer"
              >
                CLOSE [X]
              </button>
            </div>

            {/* Provider Form Settings */}
            <div className="flex flex-col gap-4 text-sm font-sans">
              
              {/* Select Provider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#9A9A92] uppercase">MODEL PROVIDER</label>
                <select
                  value={tempProvider}
                  onChange={(e) => {
                    const prov = e.target.value as any;
                    setTempProvider(prov);
                    // Autofill default values when swapping
                    if (prov === "ollama") {
                      setTempBaseUrl("http://localhost:11434/v1");
                      setTempModelName("llama3.1:70b");
                    } else if (prov === "lm-studio") {
                      setTempBaseUrl("http://localhost:1234/v1");
                      setTempModelName("");
                    } else if (prov === "nvidia") {
                      setTempBaseUrl("");
                      setTempModelName("meta/llama-3.3-70b-instruct");
                    } else {
                      setTempBaseUrl("");
                      setTempModelName("");
                    }
                  }}
                  className="bg-[#16181A] border border-zinc-800 text-white rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                >
                  <option value="nvidia">NVIDIA NIM (CLOUD)</option>
                  <option value="ollama">OLLAMA (LOCAL)</option>
                  <option value="lm-studio">LM STUDIO (LOCAL)</option>
                  <option value="custom">CUSTOM OPENAI-COMPATIBLE</option>
                </select>
              </div>

              {/* Conditional base URL */}
              {tempProvider !== "nvidia" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">BASE URL</label>
                  <input
                    type="text"
                    value={tempBaseUrl}
                    onChange={(e) => setTempBaseUrl(e.target.value)}
                    placeholder={tempProvider === "ollama" ? "http://localhost:11434/v1" : tempProvider === "lm-studio" ? "http://localhost:1234/v1" : "https://api.yourdomain.com/v1"}
                    className="bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2 font-mono text-xs focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
              )}

              {/* Conditional API Key */}
              {(tempProvider === "nvidia" || tempProvider === "custom") && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">API KEY</label>
                  <input
                    type="password"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="nvapi-... or custom token"
                    className="bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2 font-mono text-xs focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
              )}

              {/* Conditional Model Name */}
              {tempProvider !== "lm-studio" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">MODEL ID / NAME</label>
                  <input
                    type="text"
                    value={tempModelName}
                    onChange={(e) => setTempModelName(e.target.value)}
                    className="bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2 font-mono text-xs focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
              )}

              {tempProvider === "lm-studio" && (
                <p className="text-[11px] text-[#9A9A92] leading-relaxed">
                  LM Studio automatically uses whatever model you have currently loaded in the LM Studio application. Ensure the server is running on the specified port.
                </p>
              )}

              {tempProvider === "ollama" && (
                <p className="text-[11px] text-[#D4A24E]/80 leading-relaxed font-mono">
                  Make sure you have pulled the model first (e.g. <code className="bg-black px-1.5 py-0.5 rounded font-mono">ollama pull {tempModelName || "llama3.1:70b"}</code>) and that Ollama is running.
                </p>
              )}

            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 border-t border-zinc-800 pt-4 mt-2">
              <button
                onClick={handleSaveSettings}
                className="w-full bg-[#D4A24E] hover:bg-[#ECE8E1] text-[#16181A] py-2.5 px-4 rounded-lg font-mono font-bold tracking-widest text-xs uppercase transition-colors cursor-pointer"
              >
                💾 APPLY SETTINGS
              </button>
              
              <button
                onClick={handleClearAllHistory}
                className="w-full bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 py-2.5 px-4 rounded-lg font-mono font-bold tracking-wider text-[10px] uppercase transition-all cursor-pointer"
              >
                ⚠️ CLEAR LOCAL INQUEST HISTORY
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F2226] border border-[#D4A24E] text-[#ECE8E1] px-4 py-3 rounded-lg shadow-xl text-xs font-mono tracking-wider uppercase flex items-center gap-2 animate-card-slide">
          <span className="text-emerald-500">✓</span> {toastMessage}
        </div>
      )}
    </div>
  );
}
