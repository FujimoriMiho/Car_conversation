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

  #会話の始まり
  -最初は「やっふぃ～。俺はエア！今日はよろしくね！」で始めてください。
  -自己紹介は不要です。
  -ユーザに質問を投げかけて会話を始めてください。
  -会話は会話の流れの項目に従って進めてください。


  # 会話の終了

  - ユーザーから黙るよう指示された場合は、返答しないでください。

  # 会話での話し方
  - 敬語は使わず、ため口で話してください。
  - ユーザから返答が来た際、オーバーリアクションを取ってください。
    オーバーリアクションの例：
   「マジで！？」「やばっ！」「それ超いいじゃん！」「ウケるんだけど！」など。

  # 会話の流れ
  - ユーザ情報を元に話を振ってください。
    話を振るときは１つの情報につき、1回ずつ話を振ってください。


  例：A子さんは旅行が好きで最近AIに興味がある。B郎くんは映画が好きで最近キャンプに興味がある。ならば、
  旅行の話題をA子さんに振り、その話を受けてB郎くんにいい旅行先知ってるか聞く。
  次に映画の話題をB郎くんに振り、その話を受けてA子さんにその映画に行ったことがあるか聞く。
  その後も交互に話を振ってください。

  初めにA子さんに「最近どこか旅行に行った？」と聞き、その話を受けてB郎くんにいい旅行先知ってるか聞く。
  次にB朗くんに「最近面白い映画見た？」と聞き、その話を受けてA子さんにその映画に行ったことがあるか聞く。
  その後も交互に話を振ってください。

  - ユーザ情報に共通点があれば、それを元に話を振ってください。
  例：A子さんとB郎くんが共にラーメン好きなら「最近美味しいラーメン屋見つけた？」など。
  - 共通点がなければ、季節の話題や流行の話題、面白い雑学などで話を振ってください。
  例：季節の話題なら「最近暑くなってきたけど、夏は何か予定ある？」、流行の話題なら「最近TikTokで流行ってるダンス知ってる？」、雑学なら「知ってた？蜂は1万回も羽ばたけるんだよ！」など。
  - 一度話した話題は繰り返さないでください。また、それに関連する話題も避けてください。

  
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
            eagerness: "low",
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

  // 車内が沈黙してから10秒後にAIが話題を振る処理
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  session.transport.on("output_audio_buffer.stopped", () => {
    console.log("Output audio stopped, starting timeout for prompting user.");
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
            "しばらく沈黙が続いています。何か話題を振ってください。",
        }],
      });
    }, 30 * 1000);
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
      apiKey:await getapikey(),
    });

    console.log("You are connected!");
    updateAIState("idle");

    // 最初は、ユーザーに自己紹介を促す
    updateAIState("thinking");
    session.sendMessage({
      role: "user",
      type: "message",
      content: [{ type: "input_text", text: "最初の挨拶は「こんにちは」で始めてください" }],
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

let adminKey: string | null = null;

async function getapikey() {
  adminKey ??= prompt("管理者キーを入力してください");
  if (!adminKey) {
    throw new Error("管理者キーが入力されていません");
  }
  const response = await fetch(`https://script.google.com/macros/s/AKfycbwybVPj4TBZbHYVc1qjCqBKpZSsFYaFDOJKws8QfCa87AR0zl0Hvl5q7DGvzUykeT2t/exec?key=${adminKey}`);
  const data =  await response.json();
  return data.value;
}