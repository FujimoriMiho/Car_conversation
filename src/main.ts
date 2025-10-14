import "./style.css";
import { setupAgent } from "./components/agent.ts";
import { setupUserInput } from "./components/input.ts";

// UI Setup
setupUI();

setupUserInput({
  input: document.getElementById("input") as HTMLInputElement,
});

setupAgent({
  startButton: document.getElementById("ai-start-button") as HTMLButtonElement,
  stopButton: document.getElementById("ai-stop-button") as HTMLButtonElement,
  messageOutput: document.getElementById("ai-messages") as HTMLElement,
  errorOutput: document.getElementById("ai-error") as HTMLElement,
});

function setupUI() {
  // Settings toggle
  const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement;
  const settingsPanel = document.getElementById("settings-panel") as HTMLElement;

  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
    const isHidden = settingsPanel.classList.contains("hidden");
    settingsToggle.textContent = isHidden ? "⚙️ 設定" : "⚙️ 設定を閉じる";
  });

  // Debug panel toggle (double click on avatar)
  const aiAvatar = document.getElementById("ai-avatar") as HTMLElement;
  const debugPanel = document.getElementById("debug-panel") as HTMLElement;

  let clickCount = 0;
  aiAvatar.addEventListener("click", () => {
    clickCount++;
    setTimeout(() => {
      if (clickCount === 2) {
        debugPanel.classList.toggle("hidden");
      }
      clickCount = 0;
    }, 300);
  });

  // Initial AI state
  updateAIState("idle");
}

export function updateAIState(state: "idle" | "listening" | "speaking" | "thinking") {
  const app = document.getElementById("app") as HTMLElement;
  const status = document.getElementById("ai-status") as HTMLElement;
  const statusTitle = status.querySelector("h2") as HTMLElement;
  const statusText = status.querySelector("p") as HTMLElement;
  const soundWaves = document.getElementById("sound-waves") as HTMLElement;

  // Remove all state classes
  app.classList.remove("ai-idle", "ai-listening", "ai-speaking", "ai-thinking");

  // Add current state class
  app.classList.add(`ai-${state}`);

  // Update status text and sound waves
  switch (state) {
    case "idle":
      statusTitle.textContent = "準備完了";
      statusText.textContent = "スタートボタンを押して会話を始めてください";
      soundWaves.style.opacity = "0";
      break;
    case "listening":
      statusTitle.textContent = "🎧 聞いています...";
      statusText.textContent = "あなたの声を聞いています";
      soundWaves.style.opacity = "0.7";
      break;
    case "speaking":
      statusTitle.textContent = "🗣️ 話しています...";
      statusText.textContent = "AIが回答しています";
      soundWaves.style.opacity = "1";
      break;
    case "thinking":
      statusTitle.textContent = "💭 考えています...";
      statusText.textContent = "回答を準備しています";
      soundWaves.style.opacity = "0.5";
      break;
  }
}
