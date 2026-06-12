"use client";

import { useState, useEffect, useRef } from "react";
import { RoomPreset, AgentProfile, DebateMessage, Verdict } from "@/lib/types";

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
  
  // UI helper states
  const [showKey, setShowKey] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to automatically scroll the debate container
  const debateEndRef = useRef<HTMLDivElement>(null);

  // Fetch rooms and agents on load
  useEffect(() => {
    // Retrieve saved API key
    const savedKey = localStorage.getItem("mirroroom_nvapi_key");
    if (savedKey) setApiKey(savedKey);

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
        
        // Select first room by default
        if (roomsData.rooms && roomsData.rooms.length > 0) {
          setSelectedRoomId(roomsData.rooms[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error initializing application data");
      } finally {
        setLoadingRooms(false);
      }
    }

    loadData();
  }, []);

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

  // Run the sequential focus group simulation
  const handleRunSimulation = async () => {
    if (!apiKey) {
      setError("Please provide a valid NVIDIA API Key first.");
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
    setStatusText("Deliberating... Connecting to the LLM panel...");
    setActiveAgentId(null);

    try {
      // 1. Fetch the debate stream
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, ideaText, roomId: selectedRoomId })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to run debate (HTTP ${res.status})`);
      }

      if (!res.body) {
        throw new Error("No response stream body found");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      const collectedMessages: any[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep partial last line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.substring(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "status") {
                setActiveAgentId(data.agentId);
                setStatusText(`${data.name} is writing their response...`);
              } else if (data.type === "message") {
                const msg = data.message;
                // Add the completed message to the visible transcript
                setDisplayedMessages(prev => [...prev, msg]);
                // Keep track of the collected messages for verdict generation
                collectedMessages.push({
                  agentId: msg.agentId,
                  name: msg.agentName,
                  avatarEmoji: msg.avatarEmoji,
                  response: msg.content
                });
              } else if (data.type === "error") {
                throw new Error(data.error);
              } else if (data.type === "end") {
                console.log("Stream ended successfully");
              }
            } catch (jsonErr) {
              console.error("Error parsing stream event JSON:", jsonErr, trimmed);
            }
          }
        }
      }

      // Complete transcript playing
      setActiveAgentId(null);

      // Verify if we collected any messages
      if (collectedMessages.length === 0) {
        throw new Error("Simulation completed but no agent responses were received.");
      }

      // 2. Request Verdict analysis after debate completes
      setIsGeneratingVerdict(true);
      setStatusText("Focus group complete. Synthesizing verdict analysis...");
      
      const verdictRes = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, ideaText, transcript: collectedMessages })
      });
      
      const verdictData = await verdictRes.json();
      if (!verdictRes.ok) {
        throw new Error(verdictData.error || "Failed to generate summary verdict.");
      }
      
      setVerdict(verdictData.verdict);
      setStatusText("Simulation complete! Verdict rendered below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during the simulation");
      setActiveAgentId(null);
    } finally {
      setIsDebating(false);
      setIsGeneratingVerdict(false);
    }
  };

  // Helper to color-code overall score
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
    if (score >= 40) return "text-amber-500 border-amber-500/20 bg-amber-500/5";
    return "text-rose-500 border-rose-500/20 bg-rose-500/5";
  };

  return (
    <div className="min-h-screen bg-grid-glow flex flex-col antialiased">
      {/* Top Banner Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪞</span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                MirrorRoom <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded-sm font-mono">v0.1</span>
              </h1>
              <p className="text-xs text-zinc-400">Demographic AI Focus Group Simulator</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Docs
            </a>
            <span className="h-4 w-px bg-zinc-800" />
            <a
              href="https://build.nvidia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              NVIDIA build.nvidia.com
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Control Panel (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* API Key Box */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                🔑 NVIDIA NIM API Credentials
              </h2>
              <a 
                href="https://build.nvidia.com" 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-amber-500 hover:underline"
              >
                Get Free Key
              </a>
            </div>
            
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                id="api-key-input"
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="nvapi-..."
                className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-amber-600 focus:outline-hidden text-zinc-100 rounded-lg py-2 px-3 pr-10 text-sm font-mono transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Your key is saved locally in your browser and used strictly to authenticate calls directly to NVIDIA's AI endpoints.
            </p>
          </div>

          {/* Preset Selector */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-200">
              👥 Select Room Presets
            </h2>
            
            {loadingRooms ? (
              <div className="flex items-center justify-center py-6 text-zinc-500 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500 mr-2" />
                Loading focus rooms...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => {
                      if (!isDebating) setSelectedRoomId(room.id);
                    }}
                    disabled={isDebating}
                    id={`room-select-${room.id}`}
                    className={`text-left p-3.5 rounded-lg border text-sm transition-all flex flex-col gap-1.5 ${
                      selectedRoomId === room.id
                        ? "bg-amber-600/5 border-amber-600/50 shadow-[0_0_15px_rgba(217,119,6,0.1)]"
                        : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700/60 cursor-pointer"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-semibold text-zinc-100">{room.name}</span>
                      <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-sm font-mono">
                        {room.agent_ids.length} Panelists
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{room.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Concept/Idea Input */}
          <div className="glass-card p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center justify-between">
              <span>💡 What's the Idea or Policy?</span>
              <span className="text-[10px] text-zinc-500 font-normal">Describe it in detail</span>
            </h2>
            
            <textarea
              value={ideaText}
              id="idea-textarea"
              onChange={(e) => setIdeaText(e.target.value)}
              disabled={isDebating}
              placeholder="e.g. A city mandate implementing a 4-day work week for corporate offices to increase mental health and productivity..."
              rows={5}
              className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-amber-600 focus:outline-hidden text-zinc-100 rounded-lg p-3 text-sm leading-relaxed transition-colors resize-none"
            />

            {/* Quick Presets */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-zinc-500">Or pick a premade scenario:</span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_IDEAS.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => selectExample(ex)}
                    disabled={isDebating}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
                  >
                    {ex.title}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleRunSimulation}
              disabled={isDebating || !apiKey || !ideaText.trim()}
              id="start-debate-btn"
              className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all text-center flex items-center justify-center gap-2 border ${
                isDebating
                  ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                  : !apiKey || !ideaText.trim()
                  ? "bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-amber-600 text-white border-amber-500 shadow-[0_4px_20px_rgba(217,119,6,0.25)] hover:bg-amber-500 hover:shadow-[0_4px_25px_rgba(217,119,6,0.35)] cursor-pointer"
              }`}
            >
              {isDebating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Running Simulation...
                </>
              ) : (
                <>
                  <span>⚡</span> Run Focus Group Simulation
                </>
              )}
            </button>
          </div>

        </section>

        {/* Right Column: Debate Stream & Verdict Dashboard (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Panelists / Demographics Grid (Shows before starting debate) */}
          {displayedMessages.length === 0 && !isDebating && (
            <div className="glass-card p-6 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-zinc-200">
                👥 Selected Room Demographics ({currentRoomAgents.length} Panelists)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentRoomAgents.map((agent) => (
                  <div 
                    key={agent.id}
                    className="p-3 bg-zinc-900/30 border border-zinc-800/80 rounded-lg flex gap-3 text-xs"
                  >
                    <span className="text-2xl self-start">{agent.avatar_emoji}</span>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-zinc-100">{agent.name}</span>
                      <span className="text-[11px] text-zinc-400">
                        {agent.age}yo • {agent.occupation}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        📍 {agent.location.split(",").slice(0, 2).join(",")}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {agent.personality_traits.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-sm text-[9px] font-mono capitalize">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debate Transcript Box */}
          {(displayedMessages.length > 0 || isDebating) && (
            <div className="glass-card p-6 flex flex-col min-h-[400px] max-h-[600px]">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  💬 Live Focus Group Debate
                </h2>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className={`inline-block h-2 w-2 rounded-full ${isDebating ? "bg-amber-500 animate-ping" : "bg-zinc-600"}`} />
                  <span>{statusText}</span>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 select-text">
                {displayedMessages.map((msg, index) => {
                  const agent = agents.find(a => a.id === msg.agentId);
                  return (
                    <div
                      key={index}
                      className="animate-fade-in-up flex items-start gap-3 bg-zinc-900/20 border border-zinc-800/40 p-4 rounded-xl"
                    >
                      <div className="text-3xl p-1 bg-zinc-950/80 rounded-lg border border-zinc-800/60 shadow-xs">
                        {msg.avatarEmoji}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <h3 className="text-sm font-semibold text-white">{msg.agentName}</h3>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {agent?.occupation || "Panelist"}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed font-sans">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Live Typing Simulator */}
                {activeAgentId && (
                  <div className="flex items-start gap-3 bg-zinc-900/40 border border-amber-600/20 p-4 rounded-xl animate-fade-in-up">
                    <div className="text-3xl p-1 bg-zinc-950/80 rounded-lg border border-zinc-800/60 animate-pulse">
                      {agents.find(a => a.id === activeAgentId)?.avatar_emoji || "👤"}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-white animate-pulse">
                          {agents.find(a => a.id === activeAgentId)?.name}
                        </h3>
                        <span className="text-[10px] text-amber-500 font-mono">
                          Writing response...
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

          {/* Verdict Summary Dashboard */}
          {(verdict || isGeneratingVerdict) && (
            <div className="glass-card p-6 flex flex-col gap-6 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  📊 Executive Focus Group Verdict
                </h2>
                {isGeneratingVerdict && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-500" />
                    Generating analysis...
                  </span>
                )}
              </div>

              {verdict && (
                <div className="space-y-6">
                  {/* Score & Summary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Gauge Score Card */}
                    <div className={`border rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 ${getScoreColor(verdict.overallScore)}`}>
                      <span className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">Public Appeal</span>
                      <div className="relative flex items-center justify-center mt-1">
                        <span className="text-4xl font-extrabold font-mono">{verdict.overallScore}</span>
                        <span className="text-sm text-zinc-500 absolute -bottom-1 font-mono">/ 100</span>
                      </div>
                      <span className="text-[11px] font-bold uppercase mt-3">
                        {verdict.overallScore >= 70 ? "High Support" : verdict.overallScore >= 40 ? "Mixed / Polarized" : "Low Appeal"}
                      </span>
                    </div>

                    {/* Summary Paragraph */}
                    <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-5 flex flex-col justify-center gap-2">
                      <span className="text-xs text-zinc-500 font-semibold uppercase">Verdict Summary</span>
                      <p className="text-sm text-zinc-300 leading-relaxed font-sans italic">
                        "{verdict.summary}"
                      </p>
                    </div>
                  </div>

                  {/* Pros & Cons Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Support column */}
                    <div className="bg-emerald-950/5 border border-emerald-900/10 rounded-xl p-5 flex flex-col gap-3">
                      <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="text-sm">✓</span> Points of Support
                      </h3>
                      <ul className="space-y-2 text-xs text-zinc-300">
                        {verdict.topSupport.map((item, idx) => (
                          <li key={idx} className="flex gap-2 leading-relaxed">
                            <span className="text-emerald-500 select-none">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Concerns column */}
                    <div className="bg-rose-950/5 border border-rose-900/10 rounded-xl p-5 flex flex-col gap-3">
                      <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="text-sm">⚠️</span> Top Concerns Raised
                      </h3>
                      <ul className="space-y-2 text-xs text-zinc-300">
                        {verdict.topConcerns.map((item, idx) => (
                          <li key={idx} className="flex gap-2 leading-relaxed">
                            <span className="text-rose-500 select-none">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Polarizing Pair View */}
                  {verdict.mostPolarizingPair && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
                      <span className="text-xs text-zinc-500 font-semibold uppercase">Most Polarizing Contention</span>
                      
                      <div className="flex flex-col md:flex-row items-center gap-4 py-2">
                        {/* Agent 1 */}
                        <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-800/80 w-full md:w-auto">
                          <span className="text-xl">
                            {agents.find(a => a.name === verdict.mostPolarizingPair.agent1)?.avatar_emoji || "👤"}
                          </span>
                          <span className="text-xs font-bold text-white whitespace-nowrap">
                            {verdict.mostPolarizingPair.agent1}
                          </span>
                        </div>

                        {/* VS symbol */}
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                          VS
                        </span>

                        {/* Agent 2 */}
                        <div className="flex items-center gap-2 bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-800/80 w-full md:w-auto">
                          <span className="text-xl">
                            {agents.find(a => a.name === verdict.mostPolarizingPair.agent2)?.avatar_emoji || "👤"}
                          </span>
                          <span className="text-xs font-bold text-white whitespace-nowrap">
                            {verdict.mostPolarizingPair.agent2}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                        <strong className="text-zinc-200">Point of Disagreement:</strong> {verdict.mostPolarizingPair.reason}
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* General Error Log */}
          {error && (
            <div className="glass-card p-5 border-rose-950/50 bg-rose-950/5 text-rose-400 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-500">⚠️ Simulation Error</span>
              <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap">{error}</p>
            </div>
          )}

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/40 py-6 mt-12 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} MirrorRoom. Built with Next.js & NVIDIA NIM API.</p>
          <p>Bring-Your-Own-API-key model. All computations run in your session.</p>
        </div>
      </footer>
    </div>
  );
}
