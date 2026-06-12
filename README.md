# 🪞 MirrorRoom — Before you ship it, debate it.

**MirrorRoom** is an open-source focus group simulator. Describe your product, policy, campaign, or startup idea, and watch a room of diverse AI agent personas—each with distinct demographics, occupations, locations, and core belief systems—debate it sequentially in real-time. Finally, receive a detailed public appeal scorecard, pros & cons, and highlights of polarizing contentions.

---

## 🚀 How It Works

1. **Input Your Idea:** Describe your concept (e.g. a business model, regulation, product feature).
2. **Choose a Panel (Room):** Select from rooms targeting specific cultural and economic demographics (e.g. Malaysian Society, Gen Z Internet, or Silicon Valley).
3. **Watch the Debate:** Personas react sequentially. Each agent receives the full context of the idea along with the running transcript of what prior agents have argued, prompting natural reactions, disagreements, and cross-references.
4. **Get the Verdict:** An impartial analyst agent evaluates the transcript to output an overall public appeal score (0-100), key concerns, core benefits, and the most polarizing agent clash.

---

## ⚡ Tech Stack & Architecture

- **Framework:** Next.js 14/15 (App Router)
- **Styling:** Tailwind CSS (v4) with custom premium glassmorphism gradients and custom animations
- **AI Core:** NVIDIA NIM API (OpenAI-compatible) using `meta/llama-3.3-70b-instruct` (highly responsive, free tier accessible)

---

## 🔑 Setup & Installation

### Prerequisites
- Node.js (v18.x or above recommended)
- A free NVIDIA API Key from [build.nvidia.com](https://build.nvidia.com) (no credit card required for the free tier)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/mirroroom.git
cd mirroroom
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (Optional)
You can set up a default NVIDIA API key and configure the model name. Create a `.env.local` file in the root directory:
```env
# Optional: Pre-configure your NIM API Key (users can also input theirs in the UI)
NVIDIA_API_KEY=nvapi-your-key-here

# Optional: Override default model (defaults to meta/llama-3.3-70b-instruct)
NIM_MODEL=meta/llama-3.3-70b-instruct
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 👥 Available Focus Rooms

- **Malaysian Society (`malaysian-society`):** A cross-section of 9 diverse Malaysian voices covering various generations, ethnicities, religions, regions, and occupations (from retired civil servants in Alor Setar and copywriters in KL to Kopitiam owners in Klang and migrant construction workers). Ideal for testing localized products, pricing, or community policies.
- **Gen Z Internet (`gen-z-internet`):** Chronically online, digital-native personas. Perfect for testing social media apps, viral campaigns, or slang-heavy products.
- **Silicon Valley (`silicon-valley`):** Venture investors, software engineers, and internet cynics. Excellent for stress-testing startup models, B2B SaaS ideas, or VC pitches.

---

## 🛠 Customizing the AI Provider

Although built to run out-of-the-box with **NVIDIA's NIM API**, MirrorRoom is fully provider-agnostic. Since the client is OpenAI-compatible, you can point it to alternative LLM backends (like Groq, OpenAI, or a local Ollama instance) by editing the base configuration inside [lib/aiClient.ts](file:///e:/mirroroom/lib/aiClient.ts):

```typescript
// Modify these variables to target your custom API endpoint
const NIM_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](file:///e:/mirroroom/LICENSE) for details.