const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [
  {
    role: "assistant",
    content:
      "Welcome! I'm your chess assistant. Ask me about any position or move, and I'll help you find the best play. Let's train together",
  },
];
let isProcessing = false;

userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

userInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

initVoiceChat();

function initVoiceChat() {
  const micBtn = document.getElementById('mic-chat-btn');
  const voiceStatus = document.getElementById('voice-chat-status');
  const voiceText = document.getElementById('voice-chat-text');

  if (!micBtn) return;

  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    micBtn.style.opacity = '0.5';
    micBtn.title = "Voice control not supported";
    micBtn.addEventListener('click', () => alert("Not supported in this browser"));
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = true;

  let isListening = false;

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('active');
    voiceStatus.classList.remove('hidden');
    voiceText.textContent = "Listening...";
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('active');
    voiceStatus.classList.add('hidden');
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');

    userInput.value = transcript;
    userInput.dispatchEvent(new Event('input'));
  };

  recognition.onerror = (event) => {
    console.error("Voice chat error", event.error);
    isListening = false;
    micBtn.classList.remove('active');
    voiceStatus.classList.add('hidden');
  };
}

document.querySelectorAll('.quick-action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    userInput.value = btn.textContent;
    sendMessage();
  });
});

async function sendMessage() {
  const message = userInput.value.trim();

  if (message === "" || isProcessing) return;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  addMessageToChat("user", message);

  userInput.value = "";
  userInput.style.height = "auto";

  typingIndicator.classList.add("visible");

  chatHistory.push({ role: "user", content: message });

  const apiMessages = JSON.parse(JSON.stringify(chatHistory));

  if (window.chessGame) {
    const boardState = window.chessGame.getBoardStateAsString();
    const evaluation = window.chessGame.currentEvaluation;

    let engineContext = '';
    if (evaluation) {
      const evalScore = typeof evaluation.score === 'number' ? evaluation.score.toFixed(2) : evaluation.score;
      engineContext = `\n[Stockfish Analysis: Score: ${evalScore}, Best Move: ${evaluation.bestMove || 'Calculating...'}]`;
    }

    const systemContext = `\n\n[System: Current Chess Board State: ${boardState} 
     Pieces: W=White, B=Black, P=Pawn, R=Rook, K=Knight, B=Bishop, Q=Queen, KNG=King.
     Format: Raw 8x8 Array. Rows a-h, Cols 1-8 (standard chess).
     IMPORTANT: 
     1. Do NOT output the raw board array.
     2. **CRITICAL**: If 'Best Move' is 'Calculating...', YOU MUST ANALYZE THE BOARD YOURSELF based on the provided matrix. **DO NOT** tell the user to wait. **DO NOT** mention that the engine is calculating. Just give your best chess advice immediately based on the visible piece positions.
     3. Trust the Board Matrix over the Score. If pieces have moved, it is NOT the starting position, even if Score is 0.00.
     4. ${engineContext}
     5. Use the Stockfish Score if available (Positive=White adv, Negative=Black adv).]`;

    apiMessages[apiMessages.length - 1].content += systemContext;
  }

  try {
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = "message assistant-message";
    assistantMessageEl.innerHTML = "<p></p>";
    chatMessages.appendChild(assistantMessageEl);

    chatMessages.scrollTop = chatMessages.scrollHeight;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        try {
          const jsonData = JSON.parse(line);
          if (jsonData.response) {
            responseText += jsonData.response;
            assistantMessageEl.querySelector("p").textContent = responseText;
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        } catch (e) {
        }
      }
    }

    chatHistory.push({ role: "assistant", content: responseText });
  } catch (error) {
    console.error("Error:", error);
    addMessageToChat(
      "assistant",
      "Sorry, there was an error processing your request.",
    );
  } finally {
    typingIndicator.classList.remove("visible");
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

function addMessageToChat(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  messageEl.innerHTML = `<p>${content}</p>`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
