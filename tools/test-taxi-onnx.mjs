import { chromium } from "playwright";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = process.env.TEST_URL || "http://127.0.0.1:5173/education/powerpoint#rl-capitol";

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(url, { waitUntil: "networkidle" });
await page.locator("#rl-capitol").scrollIntoViewIfNeeded();

const snapshots = [];
for (let index = 0; index < 8; index += 1) {
  await page.waitForTimeout(1000);
  snapshots.push(
    await page.locator("#rl-capitol .cartpole-lane").evaluateAll((nodes) =>
      nodes.map((node) => ({
        title: node.querySelector("h3")?.textContent,
        metrics: Array.from(node.querySelectorAll(".agent-metrics dd")).map(
          (metric) => metric.textContent,
        ),
      })),
    ),
  );
}

await browser.close();

const modelSnapshots = snapshots.map((snapshot) =>
  snapshot
    .filter((lane) => lane.metrics?.[1] === "onnx")
    .map((lane) => `${lane.title}:${lane.metrics?.join("/")}`)
    .join("|"),
);
const moved = modelSnapshots.some((snapshot, index) => index > 0 && snapshot !== modelSnapshots[index - 1]);

if (!moved) {
  console.error("CartPole ONNX agents loaded, but no ONNX lane changed over time.");
  process.exit(1);
}

console.log("CartPole ONNX agents move over time.");
