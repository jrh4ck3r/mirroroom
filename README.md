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

## See It In Action

We asked MirrorRoom what it thinks of MirrorRoom.

We ran our own project idea through the Silicon Valley room a VC, a backend engineer, a chronically online skeptic, and a startup-obsessed software engineer. Here's what happened, unedited.

---

**💼 Jennifer Cho** — *Partner at an early-stage venture capital fund, San Francisco*

> I love the creativity behind MirrorRoom, but my immediate question is, what's the business model here are you planning to charge users for access to these simulated focus groups, and if so, how do you plan to acquire and retain customers at scale? The open-source aspect is intriguing, but it also raises questions about how you'll monetize the platform and ensure its long-term viability.

**🛠️ Lars** — *Senior backend engineer, 20 years experience, Stockholm*

> I appreciate Jennifer's focus on the business model, but from a technical standpoint, I'm more concerned about the complexity of simulating realistic debates and the potential for biased AI agent personas. I'd like to know more about the data used to train these AI agents and how the system will handle edge cases, such as contradictory or ambiguous input ideas.

**🙄 ratioed_again** — *Extremely online*

> Because what the world really needed was another "revolutionary" market research tool that's just a rehashed version of existing focus group software with a fancy AI coat of paint. I'm with Lars on the concern about biased AI agent personas we all know how well AI models do with nuance and subtlety (spoiler: they don't).

**🧑🏽💻 Danial** — *Software engineer at a tech company, Cyberjaya*

> I think Jennifer and Lars are focusing too much on the potential pitfalls, but I love the innovative spirit behind MirrorRoom. By leveraging these technologies, MirrorRoom could potentially disrupt the market research industry in a big way, similar to how Airbnb disrupted hospitality or Uber disrupted transportation.

---

### 📜 Verdict: HIGH SUPPORT

**Points of support:**
- Innovative application of AI to focus groups
- Potential to disrupt the market research industry
- Leveraging open-source frameworks for fine-tuning AI agent personas

**Concerns raised:**
- Potential for biased AI agent personas
- Difficulty ensuring natural behavior from AI agents
- Challenges in monetizing an open-source platform

**Most polarizing pair:** ratioed_again vs Danial disagreed on whether MirrorRoom could meaningfully disrupt market research, or is just another AI-coated rehash.

---

*Even the harshest critic in the room couldn't help but engage. That's the point.*

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

## 🛠 Local Engine Settings & Multi-Provider Support

MirrorRoom supports cloud API options as well as running fully offline on your own machine. Click the **⚙️ Settings** icon in the header to configure the LLM backend.

### 1. NVIDIA NIM (Cloud)
- Default out-of-the-box provider.
- Requires an API Key from [build.nvidia.com](https://build.nvidia.com) (free tier key available).
- Uses `meta/llama-3.3-70b-instruct` by default.

### 2. Run Fully Offline with Ollama
- Install [Ollama](https://ollama.com) on your local machine.
- Pull a compatible model (we recommend `llama3.1:70b` for full persona nuance, but smaller models like `llama3.1:8b` or `mistral:7b` work as well for testing):
  ```bash
  ollama pull llama3.1:70b
  ```
- In MirrorRoom Settings:
  - Choose **Ollama (local)**.
  - Set the base URL (default: `http://localhost:11434/v1`).
  - Enter your pulled Model ID (e.g. `llama3.1:70b`).
- No API key is needed. Internet connection is not required after loading page assets.

### 3. Run Fully Offline with LM Studio
- Install [LM Studio](https://lmstudio.ai).
- Download and load your model of choice.
- Start the Local Server in LM Studio (default port: `1234`).
- In MirrorRoom Settings:
  - Choose **LM Studio (local)**.
  - Set the base URL (default: `http://localhost:1234/v1`).
- MirrorRoom will automatically use whichever model is currently active in the LM Studio application.

### 4. Custom OpenAI-Compatible Endpoints
- Point to any OpenAI-compatible custom gateway (like Groq, OpenRouter, or self-hosted vLLM servers).
- Set your Custom Base URL, API Key (optional), and Target Model Name.

---

## 📂 Local Debate History Database

All focus group simulations are automatically saved locally at the end of each debate session.
- Database Engine: **SQLite3** via `better-sqlite3`.
- Persistence File: `data/debates.db` located at the root of the project (gitignored by default).
- **Privacy:** Your debate records, concepts, transcripts, and verdicts are stored entirely on your local machine and never leave your self-hosted instance.
- To view previous debates, click **📂 Docket Archive** in the header. Dockets can be opened in read-only review, deleted, or cleared all at once.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](file:///e:/mirroroom/LICENSE) for details.
