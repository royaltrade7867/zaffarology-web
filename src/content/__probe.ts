import { PILLAR_INSTRUCTIONS } from "@/content/instructions";
console.log(JSON.stringify(PILLAR_INSTRUCTIONS.map(p => ({
  n: p.meta.n, name: p.meta.name, title: p.title,
  steps: p.steps.length, summary: p.summary.slice(0, 40),
})), null, 1));
