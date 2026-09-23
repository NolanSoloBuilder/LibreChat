// Demo interview evidence. Not scraped research or inferred from product images.
export const needScenarios = {
  "Children at home": ["Easy to clean", "Durable"],
  "Pets at home": ["Easy to clean", "Durable"],
  "Small home": ["Compact"],
  Renter: ["Compact", "Good value"],
  "Frequent guests": ["Comfortable"],
  "Home upgrade": ["Comfortable", "Refined texture"],
  "Budget conscious": ["Good value"],
};
const interviews = {
  A: {
    audience: "Young families",
    findings: [
      ["Easy to clean", "Easy cleanup after children’s meals and daily use", 18],
      ["Durable", "Frequent use with fewer replacements", 16],
    ],
  },
  B: {
    audience: "Young renters",
    findings: [
      ["Compact", "Limited living space and easier moves", 21],
      ["Good value", "Limited first-purchase budget", 19],
    ],
  },
  C: {
    audience: "Home upgraders",
    findings: [
      ["Comfortable", "Family relaxation and long visits", 22],
      ["Refined texture", "Matches existing home style", 17],
    ],
  },
};
export function resolveNeeds(brief) {
  return brief.store_ids.map((store_id) => {
    const research = interviews[store_id];
    const answers = brief.customer_needs?.[store_id] ?? [];
    const explicit = brief.preferences?.[store_id];
    const tags =
      explicit ??
      (answers.length
        ? [...new Set(answers.flatMap((s) => needScenarios[s]))]
        : research.findings.map((f) => f[0]));
    const criteria = tags.map((tag) => ({
      tag,
      source: explicit
        ? "user_preferences"
        : answers.length
          ? "user_answers"
          : "demo_interviews",
      evidence_id:
        explicit || answers.length
          ? `brief-${store_id}`
          : `INT-${store_id}-${tag}`,
      reason: explicit
        ? "Explicit user preference"
        : answers.length
          ? answers.filter((s) => needScenarios[s].includes(tag)).join("、")
          : research.findings.find((f) => f[0] === tag)?.[1],
    }));
    return {
      store_id,
      audience: answers.length ? answers.join(" · ") : research.audience,
      baseline_audience: research.audience,
      answers,
      criteria,
      assumption: !explicit && !answers.length,
      evidence: research.findings.map(([tag, observation, mentions]) => ({
        id: `INT-${store_id}-${tag}`,
        tag,
        observation,
        mentions,
        sample_size: 30,
        method: "Simulated store interview",
        data_mode: "mock",
      })),
    };
  });
}
