/**
 * Confirms the configured provider works and reports the models it exposes.
 * Run with: npx tsx --env-file=.env.local scripts/check-provider.mts
 */
import { stubServerOnly } from "./stub-server-only.mts";

stubServerOnly();

const { activeModels, generateStructured, isAIConfigured } = await import("../src/lib/ai/client");
const { z } = await import("zod");

if (!isAIConfigured()) {
  console.error("No API key found. Add GEMINI_API_KEY or ANTHROPIC_API_KEY to .env.local.");
  process.exit(1);
}

const models = activeModels();
console.log(`provider : ${models.provider}`);
console.log(`reasoning: ${models.reasoning}`);
console.log(`writing  : ${models.writing}`);
console.log(`fast     : ${models.fast}`);

if (models.provider === "gemini") {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY!;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
  );
  if (response.ok) {
    const payload = (await response.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const usable = (payload.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace("models/", ""))
      .filter((n) => !/embedding|aqa|imagen|veo|tts|image|audio|native-audio|live/i.test(n));
    console.log(`\navailable (${usable.length}):`);
    for (const name of usable) console.log(`  ${name}`);
    for (const tier of ["reasoning", "writing", "fast"] as const) {
      const wanted = models[tier];
      console.log(`${usable.includes(wanted) ? "ok  " : "MISSING"} ${tier} → ${wanted}`);
    }
  } else {
    console.log(`\nmodel listing failed: ${response.status} ${await response.text()}`);
  }
}

console.log("\nround-trip test…");
const result = await generateStructured({
  name: "ping",
  description: "A tiny structured response used to verify the provider.",
  schema: z.object({
    ok: z.boolean(),
    capital: z.string().describe("The capital city of Japan."),
    items: z.array(z.string()).min(2).max(3).describe("Two or three primary colours."),
  }),
  system: "You answer factual questions precisely.",
  prompt: "Set ok to true, give the capital of Japan, and list primary colours.",
  tier: "fast",
  maxTokens: 500,
  temperature: 0,
});
console.log("result:", JSON.stringify(result));
console.log(result.capital.toLowerCase().includes("tokyo") ? "\nProvider is working." : "\nUnexpected answer.");
