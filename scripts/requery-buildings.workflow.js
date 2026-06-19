export const meta = {
  name: "requery-buildings",
  description: "Send a fresh agent back to each already-discovered building to answer one new question, seeded by the saved research dossier",
  phases: [
    { title: "Load", detail: "read the saved candidate dossier" },
    { title: "Requery", detail: "one agent per building answers the new question" },
    { title: "Merge", detail: "write the new field back into the dossier" },
  ],
};

/*
 * The agents that did the original verification do not stay resident. Instead,
 * the dossier in research/doorman-candidates.json holds each building's identity,
 * leasing URL, and prior findings, so a re-query is cheap and targeted: a new
 * Sonnet agent per building, pointed at the same building, asking one new thing.
 *
 * Invoke from the main loop, for example:
 *   Workflow({
 *     scriptPath: "scripts/requery-buildings.workflow.js",
 *     args: { question: "Is the front desk staffed overnight, and what are the exact hours?",
 *             field: "doormanHours" }
 *   })
 */

const question = (args && args.question) || "";
const field = (args && args.field) || "requeryAnswer";
if (!question) {
  log("No args.question provided; nothing to do.");
  return { error: "missing question" };
}

phase("Load");
const loaded = await agent(
  "Read the file research/doorman-candidates.json and return its buildings. For each, include name, address, neighborhood, and leasingUrl. Return only the structured list.",
  {
    label: "load-dossier",
    phase: "Load",
    schema: {
      type: "object",
      required: ["buildings"],
      properties: {
        buildings: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              neighborhood: { type: "string" },
              leasingUrl: { type: "string" },
            },
          },
        },
      },
    },
  }
);

const buildings = (loaded && loaded.buildings) || [];
log(`Re-querying ${buildings.length} buildings: "${question}"`);

phase("Requery");
const answers = await parallel(
  buildings.map((b) => () =>
    agent(
      `For the apartment building "${b.name}" at ${b.address || "address on file"} (leasing page: ${b.leasingUrl || "unknown"}), answer this one question using the building's own website and the web: ${question}\n\nReturn the building name exactly as given, a concise answer, the evidence or wording behind it, and the source URL. If the public record does not say, answer "Unclear" rather than guessing.`,
      {
        label: `requery:${(b.name || "building").slice(0, 20)}`,
        phase: "Requery",
        model: "sonnet",
        schema: {
          type: "object",
          required: ["name", "answer"],
          properties: {
            name: { type: "string" },
            answer: { type: "string" },
            evidence: { type: "string" },
            sourceUrl: { type: "string" },
          },
        },
      }
    )
  )
);

const clean = answers.filter(Boolean);

phase("Merge");
const summary = await agent(
  `Read research/doorman-candidates.json. For each answer below, find the matching building by name and set its "${field}" property to an object { answer, evidence, sourceUrl, askedQuestion: ${JSON.stringify(question)}, askedAt: "see run log" }. Write the updated array back to research/doorman-candidates.json (pretty-printed). Then append a short dated note under the runs section of research/README.md recording that a re-query for "${field}" was performed and how many buildings were updated. Return a tight markdown summary: how many buildings got an answer, and a bulleted list of name: answer. Do not use em dashes.\n\nAnswers JSON:\n${JSON.stringify(clean)}`,
  { label: "merge+write", phase: "Merge" }
);

return summary;
