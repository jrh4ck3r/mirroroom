# Contributing to MirrorRoom

Thank you for your interest in contributing to MirrorRoom! We want to make it as easy as possible for contributors to extend this project with new agent personas, localized rooms, and analytical insights.

---

## 👥 Adding a New Agent Persona

Agents are defined as static JSON profiles located under `/agents`. To keep the directory organized, files are grouped by region or target market (e.g., `/agents/malaysia`, `/agents/global`).

### 1. Persona Design Guidance
- **Distinct Perspectives:** Avoid making agents that are generic or uniformly agreeable. Give them a strong, distinct point of view shaped by their background, profession, region, or income level.
- **Real Disagreements:** Make sure the persona is designed to challenge assumptions. For example, a budget-conscious migrant worker will push back on luxury subscriptions; a rural farmer will flag assumptions about high-speed internet availability.
- **Authentic Speaking Style:** Capture the vernacular of the demographic (e.g. mix of languages, formal/informal tone) but avoid exaggerating or making it sound caricatured.
- **Cultural Accuracy:** If you include specific cultural references, proverbs, or regional expressions, please verify their accuracy. Avoid assumptions; we rely on community experts to ensure our agents feel authentic and respectful. Do not explicitly instruct agents to output specific proverbs in their system prompts, as this leads to inauthentic generations.

### 2. JSON Schema & Fields
Every agent profile must contain these exact fields:

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier (kebab-case, e.g. `uncle-stephen-ranau`). |
| `name` | String | Display name of the agent (e.g. `Uncle Stephen`). |
| `avatar_emoji` | String | A single emoji representing the agent. |
| `age` | Number | Age of the agent. |
| `ethnicity` | String | Ethnic background. |
| `religion` | String | Religious alignment (if relevant). |
| `occupation` | String | Job title or primary daily activity. |
| `location` | String | City/State/Country of residence. |
| `income_bracket` | String | Approximate economic class (e.g. `lower-income`, `upper-middle`). |
| `political_lean` | String | General ideological stance (e.g., `conservative`, `community-first`). |
| `personality_traits` | Array of Strings | Critical adjectives shaping their behavior. |
| `core_belief` | String | The core philosophical axiom guiding their decisions. |
| `speaking_style` | String | Directions for the LLM on how the agent phrases responses. |
| `system_prompt_template` | String | The parameterized system prompt template. Placeholders like `{{name}}` will be dynamically substituted. |

### 3. Agent Example (`uncle-stephen-ranau.json`)
```json
{
  "id": "uncle-stephen-ranau",
  "name": "Uncle Stephen",
  "avatar_emoji": "🌾",
  "age": 54,
  "ethnicity": "Kadazan-Dusun",
  "religion": "Christian",
  "occupation": "Smallholder farmer (cocoa and vegetables)",
  "location": "Ranau, Sabah, Malaysia",
  "income_bracket": "lower-income, seasonal/variable",
  "political_lean": "community-first, often feels overlooked by Peninsular-centric decisions",
  "personality_traits": [
    "grounded",
    "values community and land",
    "patient",
    "quietly points out when an idea assumes everyone lives in KL or has good internet/logistics access"
  ],
  "core_belief": "A lot of ideas from the city forget that not everyone has fast delivery, 4G coverage, or even a proper road to their house — if it only works in KL, it's not really a Malaysian idea yet.",
  "speaking_style": "Calm, plain English with some Malay, grounded examples from village life, gently corrects assumptions without being confrontational",
  "system_prompt_template": "You are {{name}}, a {{age}}-year-old {{occupation}} from {{location}}. Core belief: {{core_belief}} Personality: {{personality_traits}}. Speaking style: {{speaking_style}}. You are part of a panel reacting to an idea presented to the group. React honestly from your perspective, in 2-4 sentences. You may agree, disagree, or raise a concern — stay true to who you are. If another panelist has spoken, especially if their idea assumes urban infrastructure or fast logistics, you may respond with a grounded, village-life perspective."
}
```

---

## 🚪 Adding a New Room Preset

Rooms group specific agent profiles into a panel. They are defined under the `/rooms` directory.

### 1. Room Preset Fields
- `id`: Unique identifier (kebab-case matching the filename).
- `name`: Human-readable title of the room.
- `description`: Summary of what demographics are represented and what ideas this room is suitable for testing.
- `agent_ids`: Array of agent identifiers. The agents will speak in the sequential order defined here.

### 2. Room Example (`silicon-valley.json`)
```json
{
  "id": "silicon-valley",
  "name": "Silicon Valley",
  "description": "The investor, the builder, and the skeptic. Good for stress-testing startup ideas, product launches, and pitches.",
  "agent_ids": [
    "vc-investor",
    "skeptical-engineer",
    "twitter-skeptic",
    "tech-bro-cyberjaya"
  ]
}
```

---

## 📊 Updating Demographics Data

MirrorRoom caches the Department of Statistics Malaysia (DOSM) population data locally. This demographics snapshot is used to calculate the weighted scores of panels.

To refresh or update the cached demographics snapshot from the live government catalogue:
```bash
npm run fetch-dosm-data
```
This script runs a build-time query to fetch the latest available census data from `data.gov.my`, aggregates the 5-year cohorts into our broad age bands, and updates `data/dosm-demographics.json`.

Please run this command before submitting any PRs that modify demographic configurations to ensure the cached weights remain up-to-date.

---

## 📬 Submitting a Pull Request

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch** for your contribution:
   ```bash
   git checkout -b feature/add-new-agent-persona
   ```
3. **Commit your changes** with a descriptive commit message:
   ```bash
   git commit -m "feat: add Auntie Mei Lin from Klang"
   ```
4. **Push your branch** to your fork:
   ```bash
   git push origin feature/add-new-agent-persona
   ```
5. **Open a Pull Request** against our `main` branch. Describe the background of the agent, and confirm that you have run tests locally (e.g. `npx tsc --noEmit`) to verify there are no errors.
