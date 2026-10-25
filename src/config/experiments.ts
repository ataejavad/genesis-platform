// Experiments defined in Git (the improvement loop creates them in the database once). The first variant is the control.
export const EXPERIMENT_SEEDS = [
  {
    key: "outreach.opening",
    area: "outreach",
    hypothesis: "A first line written from the company research gets more replies than the rule-based signal line",
    metric: "prospect replies within 21 days of the first message",
    guardrail: "opt-outs",
    variants: [
      { id: "signal", description: "rule-based line from the strongest signal" },
      { id: "research", description: "line written by the research agent from a real fact" },
    ],
    minSample: 40,
    windowDays: 21,
  },
];
