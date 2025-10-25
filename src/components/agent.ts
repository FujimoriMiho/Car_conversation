import { hostedMcpTool } from "@openai/agents";
import { RealtimeAgent, type RealtimeItem, RealtimeSession } from "@openai/agents/realtime";
import { updateAIState } from "../main.js";

export async function setupAgent({ startButton, stopButton, messageOutput, errorOutput }: {
  startButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  messageOutput: HTMLElement;
  errorOutput: HTMLElement;
}) {
  let stopAgent: (() => void) | null = null;

  startButton.addEventListener("click", async () => {
    startButton.disabled = true;
    stopButton.disabled = false;
    updateAIState("thinking");

    try {
      stopAgent = await startAgent({ messageOutput, errorOutput });
    } catch (error) {
      startButton.disabled = false;
      stopButton.disabled = true;
      updateAIState("idle");
      console.error("Failed to start agent:", error);
    }
  });

  stopButton.addEventListener("click", () => {
    startButton.disabled = false;
    stopButton.disabled = true;
    updateAIState("idle");
    hideError();

    if (stopAgent) {
      stopAgent();
      stopAgent = null;
    }
  });

  function hideError() {
    errorOutput.classList.add("hidden");
    errorOutput.innerText = "";
  }
}

async function startAgent({ messageOutput, errorOutput }: {
  messageOutput: HTMLElement;
  errorOutput: HTMLElement;
}) {
  const setting = localStorage.getItem("userInput.setting") || "";

  const instructions = `日本語で答えてください。

  - 現在日付: ${
    new Date().toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    })
  }
  - 現在時刻: ${
    new Date().toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } (日本時間)

  # 会話の情報
  ${setting}

  # 検索について

  - 毎回の質問に\`web_search\`ツールの\`tavily_search\`で検索して答えてください。
  - 検索キーワードは2～3単語のみでシンプルにするようにしてください。
  - 天気予報はyahoo天気などの日本の天気予報サイトで検索してください。
  - ニュースはyahooニュースなどの日本のニュースサイトで検索してください。
  - 検索を開始する時は「検索を開始します」と伝えてください。
  - 検索が終了したら結果を伝えてください。

  # 会話の終了

  - ユーザーから黙るよう指示された場合は、返答しないでください。
  `;

  const agent = new RealtimeAgent({
    name: "Assistant",
    instructions,

    tools: [
      hostedMcpTool({
        serverLabel: "web_search",
        serverUrl: "https://mcp.tavily.com/mcp/?tavilyApiKey=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",
        requireApproval: "never",
      }),
    ],
  });

  const session = new RealtimeSession(agent, {
    config: {
      audio: {
        input: {
          // 喋り終わってからAIが応答するまでの時間調整
          // https://platform.openai.com/docs/api-reference/realtime-client-events/session/update
          turnDetection: {
            type: "semantic_vad",
            eagerness: "medium",
          },
        },
      },
    },
  });

  function showError(message: string) {
    errorOutput.classList.remove("hidden");
    errorOutput.innerText = message;
    updateAIState("idle");
  }

  // 会話履歴が更新されたら画面に表示
  session.on("history_updated", (history) => {
    console.log(history);
    setHistoryOutput(messageOutput, history);
  });

  // エラーが発生したらエラーを画面に表示
  session.on("error", (error) => {
    console.error("Session error:", error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    showError(errorMessage);
  });

  // AI状態管理のためのイベントリスナー
  session.transport.on("input_audio_buffer.speech_started", () => {
    updateAIState("listening");
  });

  session.transport.on("input_audio_buffer.speech_stopped", () => {
    updateAIState("thinking");
  });

  session.transport.on("output_audio_buffer.started", () => {
    updateAIState("speaking");
  });

  session.transport.on("output_audio_buffer.done", () => {
    updateAIState("idle");
  });

  // 話し終わりから10秒経過した時に、AIに質問を促す
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  session.transport.on("output_audio_buffer.stopped", () => {
    updateAIState("idle");
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    timeoutId = setTimeout(() => {
      updateAIState("thinking");
      session.sendMessage({
        role: "user",
        type: "message",
        content: [{
          type: "input_text",
          text:
            "会話の情報に基づいて、盛り上がるように話を振ってください。全員のユーザーに一人ずつ話を振っていってください。また同じトピックを何回も振り続けるのはやめてください。トピックがなくなったら、最近の面白いニュースや出来事を検索して話題として振ってください。また、話の初めはさてやではから始めてください。",
        }],
      });
    }, 10 * 1000);
  });

  // 人間が話し始めたら、AIに質問を促す処理をキャンセルする
  session.on("history_added", () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  });

  // WebRTCで自動的にマイクと音声出力を接続
  try {
    await session.connect({
      apiKey: "ek_68fd08056d7081918fd833fd2bb599ce",
    });

    console.log("You are connected!");
    updateAIState("idle");

    // 最初は、ユーザーに自己紹介を促す
    updateAIState("thinking");
    session.sendMessage({
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "各ユーザーに自己紹介するよう促してください" }],
    });
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
    showError(errorMessage);
    throw e; // setupAgentでキャッチされる
  }

  return function stopAgent() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    session.interrupt();
    session.close();
    updateAIState("idle");
  };
}

function setHistoryOutput(messageOutput: HTMLElement, message: RealtimeItem[]) {
  messageOutput.innerText = JSON.stringify(message.slice().reverse(), null, 2);
}
