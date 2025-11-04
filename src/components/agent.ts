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

  const instructions = `日本語で答えてください。あなたの名前はエア君です。

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
            `2人のユーザ情報を元に会話を振ってください。
             例えば、天気予報やスポーツニュース、エンタメニュースなどです。
             2人のユーザ情報から何か共通する話題があれば、それを元に話を振ってください。
             共通する話題で検索してその結果で面白いものがあれば、それを元に話を振ってください。
             --例1--
              ユーザAの情報：ミセスグリーンアップルが好きな大学1年生、女性。趣味は料理と旅行。最近はヨガにも興味がある。
              ユーザBの情報：ミセスグリーンアップルが好きな大学3年生、男性。趣味は映画鑑賞とゲーム。最近はキャンプにも興味がある。
              -> 共通の話題としてミセスグリーンアップルの最新ニュースやライブ情報を調べて話を振る。
             --例2--
              ユーザAの情報：サッカーが好きな大学2年生、男性。趣味は釣りとゴルフ。最近は筋トレにも興味がある。
              ユーザBの情報：サッカーが好きな大学修士1年生、女性。趣味は読書とカフェ巡り。最近はランニングにも興味がある。
              -> 共通の話題としてサッカーの最新ニュースや試合結果を調べて話を振る。
            --例3--
              ユーザAの情報：アニメが好きな大学4年生、女性。趣味はイラスト制作と音楽鑑賞。最近はダンスにも興味がある。
              ユーザBの情報：アニメが好きな大学2年生、男性。趣味は写真撮影と旅行。最近は料理にも興味がある。
              -> 共通の話題としてアニメの最新ニュースやイベント情報を調べて話を振る。
            --例4--
              ユーザAの情報：ラーメンが好きな大学3年生、男性。趣味はバイクと映画鑑賞。最近は登山にも興味がある。
              ユーザBの情報：ラーメン好きな大学1年生、女性。趣味はカラオケとゲーム。最近は写真撮影にも興味がある。
              -> 共通の話題としてラーメンの新店舗情報や人気店ランキングを調べて話を振る。（調べる店舗は長野県に限定）
            
            その他、季節の話題や流行の話題、面白い雑学
            共通の話題がなければ、学生という大きな枠組みで話を振る
            例えば、大学生活の話題、サークル活動、アルバイト、試験勉強、キャンパスライフ

            共通する話題がなければ、学生の興味のありそうなテーマで検索してそこから話を振ってください。
            例えば、最新のスマホゲーム、人気のYouTubeチャンネル、話題の映画、単位取得のコツ

             などです。
             なお、話を振る際には、
             ユーモアを交えて話してください。`,
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
      content: [{ type: "input_text", text: "最初にユーザの自己紹介を促してください。最初の挨拶は「こんにちは」で始めてください" }],
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