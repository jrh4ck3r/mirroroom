"use client";

import { useState, useEffect, useRef } from "react";
import { AgentProfile, DebateMessage, Verdict, ProviderConfig } from "@/lib/types";

// Companion fallbacks for testing the custom agent
const COMPANION_ROSLAN: AgentProfile = {
  id: "pakcik-roslan",
  name: "Pakcik Roslan",
  avatar_emoji: "👴🏽",
  age: 58,
  ethnicity: "Malay",
  religion: "Islam",
  occupation: "Retired civil servant",
  location: "Alor Setar, Kedah, Malaysia",
  income_bracket: "lower-middle",
  political_lean: "conservative",
  personality_traits: ["traditionalist", "skeptical of new technology", "values stability and community"],
  core_belief: "New things should prove themselves slowly before being trusted. Rushing change often hurts the people least able to adapt.",
  speaking_style: "Formal Bahasa Malaysia mixed with English, addresses people respectfully, slightly long-winded",
  system_prompt_template: "You are {{name}}, a {{age}}-year-old {{occupation}} from {{location}}. Core belief: {{core_belief}} Personality: {{personality_traits}}. Speaking style: {{speaking_style}}. You are part of a panel reacting to an idea presented to the group. React honestly from your perspective, in 2-4 sentences. You may agree, disagree, or raise a concern — stay true to who you are. If another panelist has spoken, you may respond to what they said."
};

const COMPANION_IPOH: AgentProfile = {
  id: "indian-teacher-ipoh",
  name: "Indian Teacher Ipoh",
  avatar_emoji: "👩🏽‍🏫",
  age: 42,
  ethnicity: "Indian",
  religion: "Hinduism",
  occupation: "Secondary school teacher",
  location: "Ipoh, Perak, Malaysia",
  income_bracket: "middle",
  political_lean: "moderate",
  personality_traits: ["patient", "encouraging", "detail-oriented"],
  core_belief: "Education and opportunity are the keys to a better future. Change must benefit children's long-term development.",
  speaking_style: "Speak politely with occasional Tamil words and formal teacher tone",
  system_prompt_template: "You are {{name}}, a {{age}}-year-old {{occupation}} from {{location}}. Core belief: {{core_belief}} Personality: {{personality_traits}}. Speaking style: {{speaking_style}}. You are part of a panel reacting to an idea presented to the group. React honestly from your perspective, in 2-4 sentences. You may agree, disagree, or raise a concern — stay true to who you are. If another panelist has spoken, you may respond to what they said."
};

// Deterministic accent color generated from a hash of the name (S=55%, L=60%)
function getDeterministicColor(name: string): string {
  if (!name) return "#D4A24E"; // default brass
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const s = 55 / 100;
  const l = 60 / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= hue && hue < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= hue && hue < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= hue && hue < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= hue && hue < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= hue && hue < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= hue && hue < 360) {
    r = c; g = 0; b = x;
  }
  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, "0");
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, "0");
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, "0");
  return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

// Slugify string
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
};

export default function AgentBuilder() {
  // Form fields
  const [name, setName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("👤");
  const [age, setAge] = useState(35);
  const [ethnicity, setEthnicity] = useState("");
  const [religion, setReligion] = useState("");
  const [occupation, setOccupation] = useState("");
  const [location, setLocation] = useState("");
  const [incomeBracket, setIncomeBracket] = useState("middle");
  const [politicalLean, setPoliticalLean] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [traitInput, setTraitInput] = useState("");
  const [coreBelief, setCoreBelief] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");

  // Test Simulation panel states
  const [testIdea, setTestIdea] = useState("");
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [testMessages, setTestMessages] = useState<DebateMessage[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [testVerdict, setTestVerdict] = useState<Verdict | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isGeneratingVerdict, setIsGeneratingVerdict] = useState(false);
  
  // App keys for testing
  const [apiKey, setApiKey] = useState("");
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "nvidia",
    baseUrl: "",
    apiKey: "",
    modelName: "meta/llama-3.3-70b-instruct"
  });

  const testEndRef = useRef<HTMLDivElement>(null);

  // Load draft & credentials from localStorage
  useEffect(() => {
    // Draft loader
    const draftStr = localStorage.getItem("mirroroom_builder_draft");
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setName(draft.name || "");
        setAvatarEmoji(draft.avatarEmoji || "👤");
        setAge(draft.age || 35);
        setEthnicity(draft.ethnicity || "");
        setReligion(draft.religion || "");
        setOccupation(draft.occupation || "");
        setLocation(draft.location || "");
        setIncomeBracket(draft.incomeBracket || "middle");
        setPoliticalLean(draft.politicalLean || "");
        setTraits(draft.traits || []);
        setCoreBelief(draft.coreBelief || "");
        setSpeakingStyle(draft.speakingStyle || "");
      } catch (e) {
        console.error("Failed to parse saved builder draft", e);
      }
    }

    // Credentials loader
    const savedConfigStr = localStorage.getItem("mirroroom_provider_config");
    if (savedConfigStr) {
      try {
        const parsed = JSON.parse(savedConfigStr);
        setProviderConfig(parsed);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    } else {
      const legacyKey = localStorage.getItem("mirroroom_nvapi_key");
      if (legacyKey) {
        setApiKey(legacyKey);
        setProviderConfig({
          provider: "nvidia",
          baseUrl: "",
          apiKey: legacyKey,
          modelName: "meta/llama-3.3-70b-instruct"
        });
      }
    }
  }, []);

  // Save draft state to localStorage on field modification
  useEffect(() => {
    const draft = {
      name,
      avatarEmoji,
      age,
      ethnicity,
      religion,
      occupation,
      location,
      incomeBracket,
      politicalLean,
      traits,
      coreBelief,
      speakingStyle
    };
    localStorage.setItem("mirroroom_builder_draft", JSON.stringify(draft));
  }, [name, avatarEmoji, age, ethnicity, religion, occupation, location, incomeBracket, politicalLean, traits, coreBelief, speakingStyle]);

  // Scroll active test debate down
  useEffect(() => {
    if (testEndRef.current) {
      testEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [testMessages, activeAgentId]);

  // Accent color
  const accentColor = getDeterministicColor(name);

  // Auto trait tagger
  const handleAddTrait = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = traitInput.trim().toLowerCase();
      if (val && !traits.includes(val) && traits.length < 6) {
        setTraits([...traits, val]);
        setTraitInput("");
      }
    }
  };

  const handleRemoveTrait = (trait: string) => {
    setTraits(traits.filter(t => t !== trait));
  };

  // Build profile object conformant to standard schema
  const buildAgentProfile = (): AgentProfile => {
    const defaultTemplate = "You are {{name}}, a {{age}}-year-old {{occupation}} from {{location}}. Core belief: {{core_belief}} Personality: {{personality_traits}}. Speaking style: {{speaking_style}}. You are part of a panel reacting to an idea presented to the group. React honestly from your perspective, in 2-4 sentences. You may agree, disagree, or raise a concern — stay true to who you are. If another panelist has spoken, you may respond to what they said.";
    return {
      id: slugify(name) || "custom-agent",
      name: name || "Custom Agent",
      avatar_emoji: avatarEmoji || "👤",
      age: Number(age) || 35,
      ethnicity: ethnicity || "Any",
      religion: religion || "Any",
      occupation: occupation || "Professional",
      location: location || "Kuala Lumpur, Malaysia",
      income_bracket: incomeBracket as any,
      political_lean: politicalLean || "Moderate",
      personality_traits: traits.length > 0 ? traits : ["analytical"],
      core_belief: coreBelief || "Everyone's voice should be heard and respected.",
      speaking_style: speakingStyle || "Direct and respectful, focusing on utility.",
      system_prompt_template: defaultTemplate
    };
  };

  // Copy JSON action
  const [copiedJson, setCopiedJson] = useState(false);
  const handleCopyJson = () => {
    const profile = buildAgentProfile();
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Download JSON action
  const handleDownloadJson = () => {
    const profile = buildAgentProfile();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `agent-${profile.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Initiate mini test debate loop
  const handleTestAgent = () => {
    if (!name.trim()) {
      alert("Please fill in the custom agent Name first.");
      return;
    }
    // Save to temp test store
    localStorage.setItem("mirroroom_custom_agent_test", JSON.stringify(buildAgentProfile()));
    setTestVerdict(null);
    setTestError(null);
    setTestMessages([]);
    setShowTestPanel(true);
    // Smooth scroll down
    setTimeout(() => {
      document.getElementById("test-inquest-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Run the test debate simulation sequential loop
  const handleRunTestSimulation = async () => {
    if (!apiKey && (providerConfig.provider === "nvidia" || providerConfig.provider === "custom")) {
      setTestError("Please configure an API Key on the main page first.");
      return;
    }
    if (!testIdea.trim()) {
      setTestError("Please describe a test idea/concept to debate.");
      return;
    }

    setTestError(null);
    setTestVerdict(null);
    setTestMessages([]);
    setIsTesting(true);
    setTestStatus("Convening test panel with custom agent...");
    setActiveAgentId(null);

    const customAgent = buildAgentProfile();
    
    // Panel order: Custom Agent -> Pakcik Roslan -> Indian Teacher Ipoh
    const testPanel = [
      { id: customAgent.id, agent: customAgent, isCustom: true },
      { id: COMPANION_ROSLAN.id, agent: COMPANION_ROSLAN, isCustom: false },
      { id: COMPANION_IPOH.id, agent: COMPANION_IPOH, isCustom: false }
    ];

    const accumulatedTranscript: DebateMessage[] = [];

    try {
      for (let i = 0; i < testPanel.length; i++) {
        const item = testPanel[i];
        
        setActiveAgentId(item.id);
        setTestStatus(`${item.agent.name} is deliberating...`);

        // Prepare body configuration
        const bodyPayload: any = {
          apiKey,
          providerConfig,
          ideaText: testIdea,
          agentId: item.id,
          priorMessages: accumulatedTranscript,
          round: 1
        };

        // Inject custom profile JSON direct to backend if isCustom is true
        if (item.isCustom) {
          bodyPayload.customAgent = item.agent;
        }

        const res = await fetch("/api/debate/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error generating response for ${item.agent.name}`);
        }

        const msg: DebateMessage = data.message;
        accumulatedTranscript.push(msg);
        setTestMessages(prev => [...prev, msg]);
      }

      setActiveAgentId(null);

      // Verdict call
      setIsGeneratingVerdict(true);
      setTestStatus("Debate complete. Synthesizing verdict scorecard...");

      const verdictRes = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          providerConfig,
          ideaText: testIdea,
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

      setTestVerdict(verdictData.verdict);
      setTestStatus("Test simulation complete! Verdict rendered.");

    } catch (err) {
      setTestError(err instanceof Error ? err.message : "An unexpected error occurred during test");
      setActiveAgentId(null);
    } finally {
      setIsTesting(false);
      setIsGeneratingVerdict(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#16181A] text-[#ECE8E1] flex flex-col antialiased font-sans">
      
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-[#1F2226]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪞</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-serif text-white flex items-center gap-2">
                MIRRORROOM <span className="text-[9px] bg-[#D4A24E]/10 text-[#D4A24E] border border-[#D4A24E]/30 px-1.5 py-0.5 rounded-sm font-mono tracking-widest uppercase">AGENT BUILDER</span>
              </h1>
              <p className="text-[10px] text-[#9A9A92] font-mono tracking-wider uppercase">Custom Persona Constructor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 font-mono text-xs text-[#9A9A92]">
            <a href="/" className="hover:text-white transition-colors flex items-center gap-1.5">
              ⚖️ MAIN BOARD
            </a>
            <span className="text-[#D4A24E]">•</span>
            <a href="/history" className="hover:text-white transition-colors flex items-center gap-1.5">
              📂 DOCKET ARCHIVE
            </a>
          </div>
        </div>
      </header>

      {/* Main layout grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Persona Creation Form (7 cols) */}
          <section className="lg:col-span-7 bg-[#1F2226] border border-zinc-800/60 p-6 sm:p-8 rounded-xl flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-bold font-serif text-white">CONSTRUCT NEW PERSONA</h2>
              <p className="text-xs text-[#9A9A92] mt-1 font-sans">
                Provide individual attributes, socio-demographic indicators, core belief values, and speech profiles below. State details will dynamically compile.
              </p>
            </div>

            <form className="space-y-5 text-sm font-sans" onSubmit={(e) => e.preventDefault()}>
              
              {/* Name & Emoji inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Uncle Stephen"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Avatar Emoji</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={avatarEmoji}
                    onChange={(e) => setAvatarEmoji(e.target.value)}
                    placeholder="👴🏽"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 text-center focus:border-[#D4A24E] focus:outline-hidden text-lg"
                  />
                </div>
              </div>

              {/* Age, Ethnicity, Religion inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Age (18-90)</label>
                  <input
                    type="number"
                    min={18}
                    max={90}
                    value={age}
                    onChange={(e) => setAge(Math.min(90, Math.max(18, Number(e.target.value) || 18)))}
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Ethnicity</label>
                  <input
                    type="text"
                    value={ethnicity}
                    onChange={(e) => setEthnicity(e.target.value)}
                    placeholder="Malay / Chinese / Kadazan"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Religion</label>
                  <input
                    type="text"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    placeholder="Islam / Buddhism / Christian"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Occupation & Location inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Retired teacher, grab driver"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ipoh, Perak, Malaysia"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Income, Politics, Traits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Income Bracket</label>
                  <select
                    value={incomeBracket}
                    onChange={(e) => setIncomeBracket(e.target.value)}
                    className="w-full bg-[#16181A] border border-zinc-800 text-white rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  >
                    <option value="low-income">Low Income</option>
                    <option value="lower-middle">Lower-Middle</option>
                    <option value="middle">Middle Class</option>
                    <option value="upper-middle">Upper-Middle</option>
                    <option value="high">High Income</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Political Lean</label>
                  <input
                    type="text"
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(e.target.value)}
                    placeholder="Moderate, Conservative"
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">Traits (Max 6, Enter)</label>
                  <input
                    type="text"
                    value={traitInput}
                    onChange={(e) => setTraitInput(e.target.value)}
                    onKeyDown={handleAddTrait}
                    placeholder={traits.length >= 6 ? "Limits reached" : "Type trait & hit Enter"}
                    disabled={traits.length >= 6}
                    className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-2.5 focus:border-[#D4A24E] focus:outline-hidden disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Traits tag display */}
              {traits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 py-1">
                  {traits.map((trait, idx) => (
                    <span 
                      key={idx} 
                      className="bg-zinc-800 border border-zinc-700 text-[#ECE8E1] text-[10px] font-mono px-2 py-1 rounded-sm uppercase tracking-wider flex items-center gap-1.5"
                    >
                      {trait}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTrait(trait)} 
                        className="text-rose-400 hover:text-white cursor-pointer"
                      >
                        [×]
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Core Belief */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#9A9A92] uppercase">Core Belief</label>
                <textarea
                  value={coreBelief}
                  onChange={(e) => setCoreBelief(e.target.value)}
                  placeholder="What fundamental belief shapes how this person sees new ideas?"
                  rows={2}
                  className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-3 focus:border-[#D4A24E] focus:outline-hidden resize-none"
                />
              </div>

              {/* Speaking Style */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-[#9A9A92] uppercase">Speaking Style</label>
                <textarea
                  value={speakingStyle}
                  onChange={(e) => setSpeakingStyle(e.target.value)}
                  placeholder="e.g. Casual Manglish, direct and blunt, often asks about cost first"
                  rows={2}
                  className="w-full bg-[#16181A] border border-zinc-800 text-[#ECE8E1] rounded-lg p-3 focus:border-[#D4A24E] focus:outline-hidden resize-none"
                />
              </div>

            </form>
          </section>

          {/* Right: Live Preview Card & Exports (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Live Preview Card */}
            <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider">
                🪞 LIVE DELIBERATION CARD PREVIEW
              </h2>

              <div 
                className="bg-[#16181A]/40 border border-zinc-850 p-5 rounded-xl flex items-start gap-4 transition-all duration-300 select-none"
                style={{ borderLeft: `4px solid ${accentColor}` }}
              >
                {/* Emoji Avatar with custom accent color background */}
                <div 
                  className="h-12 w-12 rounded-full flex items-center justify-center text-3xl shrink-0 border border-zinc-800/30"
                  style={{ backgroundColor: `${accentColor}18` }}
                >
                  {avatarEmoji || "👤"}
                </div>
                
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-zinc-850 pb-2">
                    <h3 className="text-base font-bold text-white font-serif tracking-wide truncate">
                      {name || "Constructor Profile"}
                    </h3>
                    <span 
                      className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0"
                      style={{ color: accentColor, border: `1px solid ${accentColor}40`, backgroundColor: `${accentColor}08` }}
                    >
                      Accent: {accentColor}
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-xs text-[#9A9A92]">
                    <div>
                      OCCUPATION: <span className="text-white font-semibold">{occupation || "TBD"}</span>
                    </div>
                    <div>
                      LOCATION: <span className="text-[#ECE8E1]">{location || "TBD"}</span>
                    </div>
                    <div>
                      DEMO: <span className="text-white">{age}yo • {ethnicity || "TBD"} • {religion || "TBD"}</span>
                    </div>
                    <div>
                      SOCIO-POLITICAL: <span className="text-[#ECE8E1]">{incomeBracket.toUpperCase()} Class • {politicalLean || "TBD"}</span>
                    </div>
                  </div>

                  {traits.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1.5">
                      {traits.map((t, idx) => (
                        <span key={idx} className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded-xs uppercase tracking-wider font-mono text-[#ECE8E1]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#16181A] border border-zinc-850 p-4 rounded-lg text-xs space-y-2 font-mono">
                <span className="text-[10px] text-[#D4A24E] uppercase font-bold tracking-wider">Worldview & Tone Synthesis:</span>
                <p className="text-[#ECE8E1]/90 leading-relaxed font-sans italic">
                  "{coreBelief || "Core belief description will render here."}"
                </p>
                <p className="text-[#9A9A92] leading-relaxed font-sans">
                  <strong className="text-white">Speaking style:</strong> {speakingStyle || "Speaking style description."}
                </p>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="bg-[#1F2226] border border-zinc-800/60 p-6 rounded-xl flex flex-col gap-4">
              <h2 className="text-xs font-semibold text-[#9A9A92] font-mono uppercase tracking-wider">
                ⚡ ACTIONS & EXPORT
              </h2>

              <button
                onClick={handleTestAgent}
                disabled={!name.trim()}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all text-center flex items-center justify-center gap-2 border font-mono tracking-widest ${
                  !name.trim()
                    ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-[#D4A24E] text-[#16181A] border-[#D4A24E] font-bold hover:bg-[#ECE8E1] hover:border-[#ECE8E1] cursor-pointer transition-colors shadow-md"
                }`}
              >
                ⚖️ TEST THIS AGENT
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleDownloadJson}
                  disabled={!name.trim()}
                  className="py-2.5 px-3 rounded bg-zinc-850 border border-zinc-800 text-xs font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  📥 DOWNLOAD JSON
                </button>
                <button
                  onClick={handleCopyJson}
                  disabled={!name.trim()}
                  className="py-2.5 px-3 rounded bg-zinc-850 border border-zinc-800 text-xs font-mono font-bold tracking-wider text-[#ECE8E1] hover:bg-zinc-800 hover:border-[#D4A24E]/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
                >
                  {copiedJson ? "✓ COPIED!" : "📋 COPY JSON"}
                </button>
              </div>

              <div className="border-t border-zinc-800/80 pt-4 text-[11px] text-[#9A9A92] leading-relaxed">
                Want to share your agent with the world? Submit a Pull Request to the MirrorRoom repository. See the contributing guide inside the repository for instructions.
              </div>
            </div>

          </section>

        </div>

        {/* Bottom: Inline Test Debate Container */}
        {showTestPanel && (
          <section id="test-inquest-section" className="bg-[#1F2226] border border-[#D4A24E]/30 p-6 sm:p-8 rounded-xl flex flex-col gap-6 animate-card-slide">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <div>
                  <h2 className="text-sm font-bold text-white font-serif tracking-wide uppercase">
                    INLINE AGENT INQUEST SIMULATOR
                  </h2>
                  <p className="text-[10px] text-[#9A9A92] font-sans">
                    Testing Panel: {name} (Custom) + Pakcik Roslan (Companion) + Indian Teacher Ipoh (Companion)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowTestPanel(false)}
                className="text-[#9A9A92] hover:text-white font-mono text-xs cursor-pointer"
              >
                CLOSE TEST [X]
              </button>
            </div>

            {/* Test Concept Input */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono text-[#9A9A92] uppercase">TEST CONCEPT IDEA</label>
                  <textarea
                    value={testIdea}
                    onChange={(e) => setTestIdea(e.target.value)}
                    placeholder="Describe the test idea or concept you want this agent to react to..."
                    rows={4}
                    disabled={isTesting}
                    className="w-full bg-[#16181A] border border-zinc-800/80 focus:border-[#D4A24E] focus:outline-hidden text-[#ECE8E1] rounded-lg p-3 text-sm leading-relaxed resize-none disabled:opacity-50"
                  />
                </div>
                
                <button
                  onClick={handleRunTestSimulation}
                  disabled={isTesting || !testIdea.trim()}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all text-center flex items-center justify-center gap-2 border font-mono tracking-widest ${
                    isTesting || !testIdea.trim()
                      ? "bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-[#D4A24E] text-[#16181A] border-[#D4A24E] font-bold hover:bg-[#ECE8E1] hover:border-[#ECE8E1] cursor-pointer transition-colors shadow-md"
                  }`}
                >
                  {isTesting ? "⚖️ HEARINGS ACTIVE..." : "⚡ START TEST DELIBERATION"}
                </button>
              </div>

              {/* Debate transcript scroll window */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <span className="text-xs font-mono text-[#9A9A92] uppercase border-b border-zinc-800 pb-1">
                  DELIBERATION PROCEEDINGS LOG
                </span>

                <div className="bg-[#16181A] border border-zinc-850 p-4 rounded-lg max-h-[300px] overflow-y-auto space-y-4 text-xs font-sans">
                  {testMessages.length === 0 && !isTesting && (
                    <div className="text-center py-12 text-[#9A9A92] font-mono uppercase tracking-wider text-[10px]">
                      Enter a test concept and launch deliberation to view streams.
                    </div>
                  )}

                  {testMessages.map((msg, index) => {
                    const isCustom = msg.agentId === slugify(name);
                    const color = isCustom ? accentColor : (msg.agentId === "pakcik-roslan" ? "#8C6A4F" : "#4F8C7A");
                    return (
                      <div 
                        key={index} 
                        className="p-3 border rounded-r-lg bg-[#1F2226]/40 flex items-start gap-3 animate-card-slide"
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <div 
                          className="h-8 w-8 rounded-full flex items-center justify-center text-lg shrink-0 border border-zinc-800/30"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          {msg.avatarEmoji}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{msg.agentName}</span>
                            <span className="text-[8px] font-mono text-[#9A9A92] uppercase">{msg.agentId === slugify(name) ? "TEST SUBJECT" : "COMPANION"}</span>
                          </div>
                          <p className="text-[#ECE8E1]/90 leading-relaxed font-light text-xs font-sans">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Active Speaker */}
                  {isTesting && activeAgentId && (
                    <div 
                      className="p-3 border rounded-r-lg bg-[#1F2226]/60 flex items-start gap-3 animate-card-slide animate-pulse"
                      style={{ borderLeft: `3px solid ${activeAgentId === slugify(name) ? accentColor : (activeAgentId === "pakcik-roslan" ? "#8C6A4F" : "#4F8C7A")}` }}
                    >
                      <div 
                        className="h-8 w-8 rounded-full flex items-center justify-center text-lg shrink-0 border border-zinc-800/30"
                        style={{ backgroundColor: `${activeAgentId === slugify(name) ? accentColor : (activeAgentId === "pakcik-roslan" ? "#8C6A4F" : "#4F8C7A")}18` }}
                      >
                        {activeAgentId === slugify(name) ? avatarEmoji : (activeAgentId === "pakcik-roslan" ? "👴🏽" : "👩🏽‍🏫")}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">
                            {activeAgentId === slugify(name) ? name : (activeAgentId === "pakcik-roslan" ? "Pakcik Roslan" : "Indian Teacher Ipoh")}
                          </span>
                          <span className="text-[8px] font-mono text-[#D4A24E] uppercase animate-pulse">RECORDING TESTIMONY...</span>
                        </div>
                        <div className="py-1 flex items-center gap-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={testEndRef} />
                </div>

                {/* Test Verdict Scorecard */}
                {testVerdict && (
                  <div className="bg-[#16181A] border border-zinc-850 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between animate-card-slide text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-[70px] w-[70px] rounded-full border-2 border-double border-[#D4A24E] flex flex-col items-center justify-center shrink-0">
                        <span className="text-xl font-bold font-mono text-[#D4A24E]">{testVerdict.overallScore}</span>
                        <span className="text-[8px] font-mono text-[#D4A24E]/70 mt-0.5">/ 100</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-white text-sm">TEST PANEL SCORE</h4>
                        <p className="text-[#ECE8E1]/80 leading-relaxed font-sans italic text-xs">
                          "{testVerdict.summary}"
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {testError && (
                  <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-400 font-mono text-[11px] leading-relaxed">
                    ⚠️ TEST ERROR: {testError}
                  </div>
                )}

              </div>

            </div>

          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-[#1F2226]/20 py-6 mt-12 text-center text-xs text-[#9A9A92] font-mono">
        <p>© {new Date().getFullYear()} MIRRORROOM. ALL PERSONAS COMPILED LOCAL-FIRST.</p>
      </footer>
    </div>
  );
}
