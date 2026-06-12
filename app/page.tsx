"use client";

import { useState } from "react";

/**
 * Minimal test harness for the data loading pipeline + NVIDIA NIM API call.
 * This is NOT the final UI — just a way to verify everything works end-to-end.
 */
export default function TestPage() {
  const [apiKey, setApiKey] = useState("");
  const [idea, setIdea] = useState("A mobile app that lets neighbours share home-cooked meals with each other for a small fee");
  const [roomId, setRoomId] = useState("malaysian-society");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/debate/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, idea, roomId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }

      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      padding: "2rem", 
      maxWidth: "800px", 
      margin: "0 auto", 
      fontFamily: "monospace",
      backgroundColor: "#0E0E10",
      color: "#F2EFE9",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        🪞 MirrorRoom — Pipeline Test
      </h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        Tests: agent loader → room loader → prompt rendering → NVIDIA NIM API call
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label>
          <span style={{ display: "block", marginBottom: "0.25rem", color: "#aaa" }}>
            NVIDIA API Key{" "}
            <a
              href="https://build.nvidia.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#76b900", fontSize: "0.85em" }}
            >
              Get a free key →
            </a>
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="nvapi-..."
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#1a1a1e",
              border: "1px solid #333",
              color: "#F2EFE9",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
          />
        </label>

        <label>
          <span style={{ display: "block", marginBottom: "0.25rem", color: "#aaa" }}>
            Room ID
          </span>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#1a1a1e",
              border: "1px solid #333",
              color: "#F2EFE9",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
          >
            <option value="malaysian-society">Malaysian Society</option>
            <option value="gen-z-internet">Gen Z Internet</option>
            <option value="silicon-valley">Silicon Valley</option>
          </select>
        </label>

        <label>
          <span style={{ display: "block", marginBottom: "0.25rem", color: "#aaa" }}>
            Idea to test
          </span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#1a1a1e",
              border: "1px solid #333",
              color: "#F2EFE9",
              borderRadius: "4px",
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        </label>

        <button
          onClick={handleTest}
          disabled={loading || !apiKey}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: loading ? "#333" : "#C2956B",
            color: "#0E0E10",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "monospace",
            fontWeight: "bold",
            fontSize: "1rem",
          }}
        >
          {loading ? "Calling NIM..." : "Test Single Agent Call"}
        </button>
      </div>

      {error && (
        <pre style={{
          marginTop: "1.5rem",
          padding: "1rem",
          backgroundColor: "#2a1515",
          border: "1px solid #5a2020",
          borderRadius: "4px",
          color: "#ff6b6b",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          Error: {error}
        </pre>
      )}

      {result && (
        <pre style={{
          marginTop: "1.5rem",
          padding: "1rem",
          backgroundColor: "#151a15",
          border: "1px solid #205a20",
          borderRadius: "4px",
          color: "#a0d0a0",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "0.85rem",
        }}>
          {result}
        </pre>
      )}
    </div>
  );
}
