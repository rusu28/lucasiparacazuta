const topicMap = [
  {
    match: ["exam", "math", "english", "school", "study", "homework"],
    response:
      "I would split study prep into three passes: find the weak chapters, practice under a timer, then review mistakes by pattern. In ReformOne, Well,Edu! can save recurring errors and turn them into targeted recap tasks.",
  },
  {
    match: ["contest", "olympiad", "competition", "excellence"],
    response:
      "For competitions, the important part is not raw volume, but problems that change how you see the topic. A specialized agent can expose the hidden idea, then a teacher can validate the solution and push harder variants.",
  },
  {
    match: ["ai", "research", "talia", "model"],
    response:
      "TalIA can work like a research lab: read papers, reproduce experiments, compare models, and turn the results into AI competitions. For a presentation, show one small measurable experiment, then connect it to education impact.",
  },
  {
    match: ["taxi", "gymnasium", "pytorch", "dqn"],
    response:
      "For Taxi-v3, keep the protocol simple: the Gymnasium observation goes into the model, the model returns 6 Q scores, and the action is argmax. The local tools API can load TorchScript-style models and expose them to the site.",
  },
];

export function createPurcarReply(
  prompt: string,
  options: { creativity?: number; temperature?: number } = {},
): string {
  const normalized = prompt.toLowerCase();
  const found = topicMap.find((topic) =>
    topic.match.some((token) => normalized.includes(token)),
  );

  const creativityNote =
    typeof options.temperature === "number" && options.temperature > 1.5
      ? " Creativity is high, so I may explore more freely; verify important details with sources or a teacher."
      : "";

  if (found) {
    return `${found.response}${creativityNote}`;
  }

  return `I would build the answer in three steps: clarify the goal, choose the method with the best effort-to-result ratio, then verify it with a concrete example. For ReformOne, I can connect the question to education, AI research, or the PURCAR product.${creativityNote}`;
}
