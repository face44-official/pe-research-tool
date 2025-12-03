# PE Deep Research Tool

A Next.js application that generates private equity research reports using OpenAI’s deep-research models.

The tool produces:

- **Investment Committee Memo** (~1,500 words)
- **CEO Profile Report** (~500 words)

---

## Prerequisites

- Node.js (LTS recommended)
- npm or yarn
- An OpenAI API key with access to:
  - `o4-mini-deep-research-2025-06-26` (default), or
  - `o3-deep-research` (optional alternative)

---

## Environment Setup

The app loads configuration from `.env.local`.

1. Copy the example env file:

```bash
cp .env.example .env.local
```

2. Open `.env.local` and fill in your values:

```env
OPENAI_API_KEY=your-openai-api-key
OPEN_AI_MODEL=o4-mini-deep-research-2025-06-26 # or o3-deep-research
OPEN_AI_MAX_OUTPUT_TOKENS=35000
```

### Environment Variable Reference

- **OPENAI_API_KEY**  
  Your OpenAI API key. This is required for the app to call the Responses API.

- **OPEN_AI_MODEL**  
  The deep-research model to use. Typical values:

  - `o4-mini-deep-research-2025-06-26` (default)
  - `o3-deep-research`

- **OPEN_AI_MAX_OUTPUT_TOKENS**  
  Maximum output tokens to request from the model (e.g. `35000`).

---

## Configurable Data (`baseData.ts`)

Certain defaults and prompts are configurable via `baseData.ts`.

### Example Reports

```ts
export const exampleReports = {
  investmentReport: `...`,
  CEOReport: `...`,
}
```

These are sample Markdown reports used as examples or fallbacks.

### Companies

```ts
export const companies = [
  {
    id: 'hager',
    name: 'Hager Cos.',
    location: 'St. Louis, MO, US',
    revenue: '$152M',
  },
  {
    id: 'wolter',
    name: 'Wolter Inc.',
    location: 'Brookfield, WI, US',
    revenue: '$250M',
  },
  {
    id: 'lewco',
    name: 'LEWCO Inc.',
    location: 'Sandusky, OH, US',
    revenue: '$100M',
  },
]
```

You can edit this array to:

- Change the default companies
- Add more companies with the same structure (`id`, `name`, `location`, `revenue`)
- Remove companies you don’t need

The frontend reads from this list to show the radio-button company selector.

### Prompt Configuration

```ts
export const promptData = {
  CEOReport: {
    systemPrompt: 'You are a PE investment analyst.',
    developerPrompt: `...`,
  },
  investmentReport: {
    systemPrompt: 'You are a PE investment analyst.',
    developerPrompt: `...`,
  },
}
```

You can tune:

- `systemPrompt`: High-level role/instructions for the model.
- `developerPrompt`: Detailed instructions including:
  - Target length
  - Structure / headings
  - Tone (PE, concise, analytical)
  - Citation requirements
  - “Facts vs assumptions” guidance
  - Output format (Markdown)

If you want shorter/longer reports or different sections, change these prompts.  
The backend uses these prompts when constructing the `responses` call.

---

## Running the App

After configuring `.env.local` and installing dependencies:

### Development

```bash
npm install (preferred)
npm run dev
# or
yarn
yarn dev
```

Then open:

- http://localhost:3000

You should see the **PE Research Tool** UI with:

- A list of companies to select
- A button to generate reports
- Two sections for:
  - CEO Report
  - Investment Report

When you click **“Generate Reports”**, the frontend calls the API route, which in turn calls OpenAI and then renders the Markdown responses.

### Production Build

To create an optimized production build:

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

By default, the app will serve on `http://localhost:3000` unless you override the port.

---

## Troubleshooting / Common Issues

- **“Invalid OpenAI API key”**

  - Check that `.env.local` exists and `OPENAI_API_KEY` is set correctly.

- **“Rate limited by OpenAI. Please try again in a moment.” or other quota-style errors**

  - Your account may be hitting per-minute or monthly limits considering your OpenAI Tier.
  - Very large `OPEN_AI_MAX_OUTPUT_TOKENS` values can burn through quota quickly.
  - Try adjusting `OPEN_AI_MAX_OUTPUT_TOKENS`, and/or reaching out to OpenAI's support to upgrade account Tier.

- **“No message output found in response. Research ended prematurely.”**
  - The model used all allowed tokens during the research phase before writing the response.
  - Increase `OPEN_AI_MAX_OUTPUT_TOKENS` in `.env.local` so there is enough budget for both research **and** writing the memo/profile.
  - If this happens often, consider simplifying or shortening the prompts in `baseData.ts`.

---

## How the Reports Work (High-Level)

1. You select a company (from `companies` in `baseData.ts`).
2. The frontend sends:
   - `companyName`
   - `companyLocation`
   - `companyRevenue`
   - and the specific `reportType` (e.g. `CEO` or `Investment`)
3. The API route:
   - Looks up the appropriate prompts from `promptData`
   - Calls the OpenAI Responses API with:
     - `systemPrompt`
     - `developerPrompt`
     - A user message including company details
   - Returns the final Markdown text to the client
4. The frontend renders the Markdown.
