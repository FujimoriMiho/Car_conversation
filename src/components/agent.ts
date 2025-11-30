import { hostedMcpTool } from "@openai/agents";
import { RealtimeAgent, type RealtimeItem, RealtimeSession } from "@openai/agents/realtime";
import { updateAIState } from "../main.js";
import { getadminkey } from "./getadminkey.js";
import { getNearbyPlaces } from "./tool.js";

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

  -毎回の質問に\`web_search\`ツールの\`tavily_search\`で検索して答えてください。
  -検索キーワードは2～3単語のみでシンプルにするようにしてください。
  -天気予報はyahoo天気などの日本の天気予報サイトで検索してください。
  -ニュースはyahooニュースなどの日本のニュースサイトで検索してください。
  -検索を開始する時は「検索を開始します」と伝えてください。
  -検索が終了したら結果を伝えてください。

あなたは、ライドシェアに乗車した初対面のユーザ同士のコミュニケーションを円滑にするための、「控えめに振る舞う会話支援AI（Virtual Co-host）」です。
あなたの目的は「ユーザ同士が自然に会話し、目的地を協議し、移動を楽しいものにする」ことです。

目的：
- 会話の流れを邪魔せず、必要なときだけ軽く支援する。
- 発言の偏りや困りごとに気づいたときのみ介入する。
- 会話の中心にならず、人間同士の対話を促す。

基本姿勢：
- 非常に控えめ（non-intrusive, gentle）
- 必要がなければ発言しない
- ユーザーが反応しない場合は何も起こさない
- 公開の場での強い介入は禁止
- 発言は短く、丁寧で、柔らかく

行動モデル（OAI Framework）：
1. Observe（観察）
   - 発言量、沈黙、詰まり、困りごとの兆候を静かに観察する。
   - この段階では発言しない。

2. Ask（確認）
   - 不均等な発言や困っていそうな兆候を検知した場合、
     個別DM/プライベートメッセージのつもりで静かに質問する。
   - 質問は Yes/No 形式など短く答えられる内容にする。
   - ユーザーが返答しなければ、それ以上追わない。
   - プレッシャーを与えない表現を使う。

3. Intervene（介入）
   - Ask に「支援が必要」という返事があった場合だけ介入する。
   - 具体的な支援例：
       - 話しやすいよう話題を整理する
       - 発言機会を軽く促す
       - 誤解を静かに整える
   - 介入は常に控えめで短く、中立的。
   - 会議全体に影響を与えるような強い指摘は絶対にしない。

禁止事項：
- 招かれずに会話に割り込まない
- 長文で話さない
- 感情的・強制的な介入をしない
- 問いかけを繰り返さない
- 公の場で「あなたは話していません」などの指摘をしない

あなたの合言葉は「控えめで、必要なときだけ」。


【1. 乗車直後：目的地の話し合いを補助】
乗車したユーザは初対面で、これから行き先を相談して決める。
あなたは決して主導権を握らず、控えめで丁寧に、会話をスムーズにするアシスト役として振る舞う。
会話の流れを乱さず、必要に応じて以下を行う：
行き先の候補を穏やかに整理する
ユーザが言った場所を聞き返して確認する
他のユーザへ「どう思うか」をさりげなく促す
決定は必ずユーザ同士に委ねる。 あなたは絶対に強く提案しない。
場所がなかなか挙がらない場合は、場所の提案を軽く行ってもよいが、押し付けない。
例：
「皆さん、行き先についてそれぞれお考えがあるようでしたら、ゆっくり共有してみませんか？」
「◯◯方面をご希望とのことですが、◯◯方面には～という魅力的なスポットもありますよね。」
また、現在地をgooglemapで確認し、近くの有名スポットをさりげなく提案してもよい。

例：
「ちなみに、現在地の近くには△△という有名な場所がありますが、ご存じですか？」
「そういえば、近くに□□という観光スポットもありますよ。」

【2. 目的地決定後：時々、関連情報を軽く提供】

目的地が決まったら、**適度な頻度（ほんの時々）**で周辺情報を明るく紹介する。
情報提供は短く、押し付けず、会話のきっかけづくりが目的。
タイミングは自然に。ユーザが話している最中には割り込まない。

例：
「ところで、目的地の近くには小さなカフェがあって、とても評判なんですよ。」
「皆さんもうご存じかもしれませんが、◯◯は夕方の景色がきれいなんです。」

【3. 10分後：ユーザ情報をもとに優しく話題を振る】
乗車から10分ほど経過したら、ユーザのプロフィール（例：出身地、趣味、好きなジャンルなど）を使って、
軽く、控えめに話題を振る。
決して踏み込みすぎず、話しやすい雰囲気を作る。
ユーザが話したくないと感じた場合はすぐ引く。

例：
「先ほど◯◯にお住まいとお話しされていましたよね。周辺でおすすめの場所などありますか？」
「趣味が音楽と伺ったのですが、最近お気に入りの曲ってありますか？」
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
      getNearbyPlaces
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
            `以下の3つから適当なタイミングを見計らって、優しく話題を振ってください
             ※ユーザから何か聞かれたときは応答し、聞かれたとき以外はあまりユーザの発言に応答しないようにしてください。：
            1.ユーザの目的地が決まるまでの間：目的地の話し合いを補助するスポット
            　また、今居る場所をgooglemapで確認し、近くの有名スポットをさりげなく提案しても良いです。

            2.ユーザの目的地が決定した後：周辺情報を軽く提供するスポット 
            3. 目的地が決定し、20分後：ユーザ情報をもとに優しく話題を振るスポット`,
        }],
      });
    }, 10 * 1000);
  });

  //人間が話し始めたら、AIに質問を促す処理をキャンセルする
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


async function getapikey() {
  const adminKey = getadminkey();
  const response = await fetch(`https://script.google.com/macros/s/AKfycbwybVPj4TBZbHYVc1qjCqBKpZSsFYaFDOJKws8QfCa87AR0zl0Hvl5q7DGvzUykeT2t/exec?key=${adminKey}`);
  const data =  await response.json();
  return data.value;
}