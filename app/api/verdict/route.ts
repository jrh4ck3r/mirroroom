import { NextRequest, NextResponse } from "next/server";
import { generateVerdict } from "@/lib/aiClient";
import { DebateMessage } from "@/lib/types";
import { loadAgentById } from "@/lib/agentLoader";
import fs from "fs";
import path from "path";

/**
 * Stack-based matching to extract the largest valid {...} substring from a string.
 */
function extractLargestJsonSubstring(str: string): string | null {
  const startIndex = str.indexOf("{");
  if (startIndex === -1) return null;

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endIndex = -1;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }
  }

  if (endIndex !== -1) {
    return str.substring(startIndex, endIndex + 1);
  }

  // Fallback to simple lastIndexOf if stack-based matching failed to find a clean closure
  const lastBrace = str.lastIndexOf("}");
  if (lastBrace > startIndex) {
    return str.substring(startIndex, lastBrace + 1);
  }

  return null;
}

/**
 * Attempts to parse the response as JSON, with cleanup of markdown blocks and bracket-matching fallbacks.
 */
function cleanAndParseJson(raw: string): any {
  let cleaned = raw.trim();
  
  // Strip code fences
  cleaned = cleaned.replace(/^```json\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/, "");
  cleaned = cleaned.replace(/\s*```$/, "");
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    console.warn("[json-parser] Standard JSON parsing failed. Attempting bracket extraction fallback...");
    const substring = extractLargestJsonSubstring(raw);
    if (substring) {
      try {
        return JSON.parse(substring.trim());
      } catch (secondError) {
        console.error("[json-parser] Failed parsing extracted substring:", substring, secondError);
      }
    }
    throw firstError;
  }
}

/**
 * POST /api/verdict
 *
 * Generates an analytical summary and scorecard for a given idea and debate transcript.
 *
 * Body: { apiKey: string, providerConfig?: any, ideaText: string, transcript: any[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, providerConfig, ideaText, transcript, rebuttalText } = body;

    let finalApiKey = apiKey;
    if (providerConfig?.apiKey) {
      finalApiKey = providerConfig.apiKey;
    }
    // Bypass key validation for local providers
    if (providerConfig && (providerConfig.provider === "ollama" || providerConfig.provider === "lm-studio")) {
      if (!finalApiKey) finalApiKey = "dummy_key";
    }

    if (!finalApiKey) {
      if (providerConfig?.provider === "openrouter") {
        finalApiKey = process.env.OPENROUTER_API_KEY;
      } else {
        finalApiKey = process.env.NVIDIA_API_KEY;
      }
    }

    // Validate inputs
    if (!finalApiKey || typeof finalApiKey !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid API Key. Please configure it in Settings." },
        { status: 400 }
      );
    }
    if (!ideaText || typeof ideaText !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid ideaText" },
        { status: 400 }
      );
    }
    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "Missing or invalid transcript" },
        { status: 400 }
      );
    }

    // Map client transcript to DebateMessage objects
    const debateMessages: DebateMessage[] = transcript.map((m: any, index: number) => ({
      agentId: m.agentId || `agent-${index}`,
      agentName: m.name || m.agentName || "Panelist",
      avatarEmoji: m.avatarEmoji || "👤",
      content: m.response || m.content || "",
      round: m.round || 1,
      timestamp: m.timestamp || Date.now(),
      modelLabel: m.modelLabel || "",
    }));

    console.log(`[verdict] Generating verdict for idea via provider "${providerConfig?.provider || "nvidia"}"`);
    const rawVerdict = await generateVerdict(finalApiKey, ideaText, debateMessages, providerConfig, rebuttalText);

    try {
      const parsedVerdict = cleanAndParseJson(rawVerdict);

      // Calculate weighted/unweighted scores
      const uniqueAgentIds = Array.from(new Set(debateMessages.map(m => m.agentId)));
      
      // Load agent profiles and check demographic weights
      const agentProfiles = uniqueAgentIds.map(id => loadAgentById(id));
      const hasWeights = agentProfiles.every(p => p && typeof p.demographic_weight === "string");
      
      // Helper to match agent sentiment scores from JSON
      const getSentimentScore = (agentName: string, agentId: string, scores: any): number | null => {
        if (!scores || typeof scores !== 'object') return null;
        
        // Exact name match
        if (typeof scores[agentName] === 'number') return scores[agentName];
        
        // Exact ID match
        if (typeof scores[agentId] === 'number') return scores[agentId];
        
        // Case-insensitive name match
        const normName = agentName.toLowerCase().trim();
        const keyMatch = Object.keys(scores).find(k => k.toLowerCase().trim() === normName);
        if (keyMatch && typeof scores[keyMatch] === 'number') return scores[keyMatch];
        
        // Substring match
        const subKeyMatch = Object.keys(scores).find(k => {
          const kNorm = k.toLowerCase().trim();
          return kNorm.includes(normName) || normName.includes(kNorm);
        });
        if (subKeyMatch && typeof scores[subKeyMatch] === 'number') return scores[subKeyMatch];
        
        return null;
      };

      const agentScores = uniqueAgentIds.map((id, index) => {
        const profile = agentProfiles[index];
        const name = profile?.name || `Agent ${id}`;
        const rawScore = getSentimentScore(name, id, parsedVerdict.agentSentimentScores);
        const score = rawScore !== null ? rawScore : (parsedVerdict.overallScore ?? 50);
        return {
          id,
          profile,
          score
        };
      });

      if (hasWeights) {
        // Load demographics weights
        let weights: Record<string, number> = {};
        try {
          const filePath = path.join(process.cwd(), "data", "dosm-demographics.json");
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(content);
            weights = parsed.weights || {};
          }
        } catch (err) {
          console.error("[verdict] Failed to read demographics file:", err);
        }

        const scoredWithWeights = agentScores.map(item => {
          const wKey = item.profile!.demographic_weight!;
          const weight = weights[wKey] ?? 0;
          return { ...item, weight };
        });

        const totalWeight = scoredWithWeights.reduce((sum, item) => sum + item.weight, 0);
        let finalScore = 0;
        if (totalWeight > 0) {
          finalScore = scoredWithWeights.reduce((sum, item) => sum + item.score * (item.weight / totalWeight), 0);
          finalScore = Math.round(finalScore);
        } else {
          const sumScores = scoredWithWeights.reduce((sum, item) => sum + item.score, 0);
          finalScore = Math.round(sumScores / scoredWithWeights.length);
        }

        parsedVerdict.overallScore = finalScore;
        parsedVerdict.isWeighted = true;
      } else {
        // Unweighted fallback
        const sumScores = agentScores.reduce((sum, item) => sum + item.score, 0);
        const finalScore = agentScores.length > 0 ? Math.round(sumScores / agentScores.length) : (parsedVerdict.overallScore ?? 50);
        
        parsedVerdict.overallScore = finalScore;
        parsedVerdict.isWeighted = false;
      }

      return NextResponse.json({ verdict: parsedVerdict });
    } catch (parseError) {
      console.error("[verdict] Failed to parse verdict JSON after all attempts:", rawVerdict, parseError);
      return NextResponse.json(
        { error: "JSON_PARSE_FAILED", rawResponse: rawVerdict },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[verdict] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
