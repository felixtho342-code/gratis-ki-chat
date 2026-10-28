const chat = document.getElementById("chat");
const messagesElement = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const composer = document.getElementById("composer");
const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send-button");
const statusElement = document.getElementById("status");
const clearButton = document.getElementById("clear-button");
const updatesButton = document.getElementById("updates-button");
const exportButton = document.getElementById("export-button");
const voiceButton = document.getElementById("voice-button");
const providerSelect = document.getElementById("provider-select");
const puterModelField = document.getElementById("puter-model-field");
const puterModelSelect = document.getElementById("puter-model-select");
const puterLoginButton = document.getElementById("puter-login-button");

const STORAGE_KEY = "gratis-ki-chat-messages";
let messages = loadMessages();
let busy = false;
let recognition = null;
let voiceError = false;
let puterSdkPromise;
let puterModels = [];
let puterSignedIn = false;

function loadMessages() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (
      Array.isArray(stored) &&
      stored.every(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      )
    ) {
      return stored.slice(-100);
    }
  } catch (error) {
    console.error("Der gespeicherte Chat konnte nicht geladen werden.", error);
  }
  return [];
}

function saveMessages() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch (error) {
    console.error("Der Chat konnte nicht gespeichert werden.", error);
    setStatus("Der Chat konnte nicht lokal gespeichert werden.", true);
  }
}

function setStatus(text, isError = false) {
  statusElement.textContent = text;
  statusElement.classList.toggle("error", isError);
}

function createMessage(message, isError = false) {
  const row = document.createElement("article");
  row.className = `message ${message.role}${isError ? " error" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = message.role === "assistant" ? "✦" : "Du";

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = message.content;
  row.append(avatar, body);
  if (message.role === "assistant" && !isError) {
    const speakButton = document.createElement("button");
    speakButton.className = "speak-button";
    speakButton.type = "button";
    speakButton.textContent = "Vorlesen";
    speakButton.setAttribute("aria-label", "Antwort vorlesen");
    speakButton.addEventListener("click", () => speakMessage(message.content));
    body.append(speakButton);
  }
  return row;
}

function renderMessages() {
  messagesElement.replaceChildren(
    ...messages.map((message) => createMessage(message))
  );
  welcome.hidden = messages.length > 0;
  chat.scrollTop = chat.scrollHeight;
}

function setBusy(value) {
  busy = value;
  sendButton.disabled = value;
  promptInput.disabled = value;
  voiceButton.disabled = value || !recognition;
}

function speakMessage(text) {
  if (!("speechSynthesis" in window)) {
    setStatus("Vorlesen wird auf diesem Gerät nicht unterstützt.", true);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.onerror = (event) => {
    setStatus(`Vorlesen fehlgeschlagen: ${event.error}`, true);
  };
  window.speechSynthesis.speak(utterance);
}

function configureVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceButton.disabled = true;
    voiceButton.title = "Spracheingabe wird von dieser Electron-Version nicht unterstützt";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-DE";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    voiceError = false;
    voiceButton.classList.add("recording");
    voiceButton.setAttribute("aria-label", "Spracheingabe beenden");
    setStatus("Ich höre zu ...");
  };
  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = 0; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }
    promptInput.value = transcript;
    resizeInput();
  };
  recognition.onerror = (event) => {
    voiceError = true;
    const details =
      event.error === "not-allowed"
        ? "Bitte erlaube den Mikrofonzugriff in den Windows-Einstellungen."
        : `Spracheingabe fehlgeschlagen: ${event.error}`;
    setStatus(details, true);
  };
  recognition.onend = () => {
    voiceButton.classList.remove("recording");
    voiceButton.setAttribute("aria-label", "Spracheingabe starten");
    if (!busy && !voiceError) setStatus("");
    promptInput.focus();
  };
  voiceButton.disabled = false;
}

function loadPuterSdk() {
  if (window.puter) return Promise.resolve(window.puter);
  if (puterSdkPromise) return puterSdkPromise;

  puterSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.onload = () => {
      if (window.puter) {
        resolve(window.puter);
      } else {
        reject(new Error("Puter.js wurde geladen, ist aber nicht verfügbar."));
      }
    };
    script.onerror = () => reject(new Error("Puter.js konnte nicht geladen werden."));
    document.head.append(script);
  });
  return puterSdkPromise;
}

function isFreePuterModel(model) {
  if (!model || typeof model.id !== "string") return false;
  if (model.id.endsWith(":free")) return true;
  const cost = model.cost;
  return Boolean(
    cost &&
      cost.currency === "usd-cents" &&
      Number(cost.input) === 0 &&
      Number(cost.output) === 0
  );
}

async function loadPuterModels() {
  try {
    const puter = await loadPuterSdk();
    puterSignedIn = await puter.auth.isSignedIn();
    const models = await puter.ai.listModels();
    puterModels = models.filter(isFreePuterModel);
    puterModelSelect.replaceChildren();

    if (puterModels.length === 0) {
      puterModelSelect.add(new Option("Derzeit keine Gratis-Modelle", ""));
      puterModelSelect.disabled = true;
      updateProviderControls();
      return;
    }

    for (const model of puterModels) {
      const label = model.name ? `${model.name} (${model.provider})` : model.id;
      puterModelSelect.add(new Option(label, model.id));
    }
    puterModelSelect.disabled = !puterSignedIn;
    updateProviderControls();
  } catch (error) {
    puterModelSelect.replaceChildren(new Option("Modelle nicht erreichbar", ""));
    puterModelSelect.disabled = true;
    setStatus(
      `Puter-Modelle konnten nicht geladen werden: ${error.message}`,
      true
    );
  }
}

function updateProviderControls() {
  const usePuter = providerSelect.value === "puter";
  puterModelField.hidden = !usePuter;
  puterLoginButton.hidden =
    providerSelect.value === "pollinations" || puterSignedIn;
  puterLoginButton.textContent = usePuter
    ? "Mit Puter anmelden"
    : "Ausweichanbieter verbinden";
  puterModelSelect.disabled = !puterSignedIn || puterModels.length === 0;
  if (usePuter && !puterSignedIn) {
    setStatus("Puter benötigt eine kostenlose Anmeldung und ein eigenes Gratis-Kontingent.");
  }
}

function isPollinationsRateLimited(error) {
  return /Pollinations.*HTTP (402|429)|HTTP (402|429)/i.test(error.message || "");
}

async function sendWithPuter(requestMessages) {
  if (!puterSignedIn || puterModels.length === 0) {
    await loadPuterModels();
  }
  if (!puterSignedIn) {
    throw new Error(
      "Der Pollinations-Dienst ist ausgelastet. Melde dich kostenlos bei Puter an, um den Ausweichanbieter zu nutzen."
    );
  }
  if (!puterModelSelect.value && puterModels.length > 0) {
    puterModelSelect.value = puterModels[0].id;
  }
  const model = puterModelSelect.value;
  if (!model || !puterModels.some((entry) => entry.id === model)) {
    throw new Error("Bitte wähle ein verfügbares Puter-Gratis-Modell.");
  }

  const puter = await loadPuterSdk();
  const result = await puter.ai.chat(
    [
      {
        role: "system",
        content:
          "Du bist ein hilfreicher KI-Assistent. Antworte klar und auf Deutsch, ausser der Nutzer wuenscht eine andere Sprache."
      },
      ...requestMessages
    ],
    { model }
  );
  const content = result?.message?.content ?? result?.content ?? result;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .filter((part) => part && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) return text;
  }
  throw new Error("Das ausgewählte Puter-Modell hat keinen Text zurückgegeben.");
}

async function submitMessage(text) {
  const content = text.trim();
  if (!content || busy) return;

  messages.push({ role: "user", content });
  renderMessages();
  saveMessages();
  promptInput.value = "";
  resizeInput();
  setBusy(true);
  setStatus("Die KI denkt nach ...");

  const requestMessages = messages
    .slice(-20)
    .map(({ role, content: messageContent }) => ({
      role,
      content: messageContent.slice(0, 12000)
    }));

  try {
    let answer;
    if (providerSelect.value === "puter") {
      answer = await sendWithPuter(requestMessages);
    } else {
      try {
        answer = await window.chatApp.sendMessage(requestMessages);
      } catch (error) {
        if (providerSelect.value !== "auto" || !isPollinationsRateLimited(error)) {
          throw error;
        }
        setStatus("Pollinations ist ausgelastet – wechsle zum Puter-Ausweichanbieter ...");
        answer = await sendWithPuter(requestMessages);
      }
    }
    messages.push({ role: "assistant", content: answer });
    saveMessages();
    renderMessages();
    setStatus("");
  } catch (error) {
    const message = error && error.message ? error.message : "Unbekannter Fehler.";
    messagesElement.append(
      createMessage({ role: "assistant", content: message }, true)
    );
    chat.scrollTop = chat.scrollHeight;
    setStatus(message, true);
  } finally {
    setBusy(false);
    promptInput.focus();
  }
}

function resizeInput() {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 160)}px`;
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  submitMessage(promptInput.value);
});

promptInput.addEventListener("input", resizeInput);
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    submitMessage(button.textContent);
  });
});

clearButton.addEventListener("click", () => {
  messages = [];
  saveMessages();
  renderMessages();
  setStatus("");
  promptInput.focus();
});

exportButton.addEventListener("click", () => {
  if (messages.length === 0) {
    setStatus("Es gibt noch keinen Chat zum Exportieren.");
    return;
  }

  const transcript = messages
    .map((message) => {
      const speaker = message.role === "user" ? "Du" : "KI";
      return `## ${speaker}\n\n${message.content}`;
    })
    .join("\n\n---\n\n");
  const file = new Blob([`${transcript}\n`], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ki-chat-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Chat wurde als Markdown-Datei exportiert.");
});

voiceButton.addEventListener("click", () => {
  if (!recognition) return;
  if (voiceButton.classList.contains("recording")) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (error) {
      setStatus(`Spracheingabe konnte nicht gestartet werden: ${error.message}`, true);
    }
  }
});

providerSelect.addEventListener("change", updateProviderControls);

puterLoginButton.addEventListener("click", async () => {
  puterLoginButton.disabled = true;
  setStatus("Puter wird geladen ...");
  try {
    const puter = window.puter;
    if (!puter) {
      await loadPuterSdk();
      setStatus("Puter ist bereit. Klicke erneut auf Anmelden.");
      return;
    }

    await puter.auth.signIn();
    puterSignedIn = await puter.auth.isSignedIn();
    if (!puterSignedIn) {
      throw new Error("Die Puter-Anmeldung wurde nicht bestätigt.");
    }
    puterLoginButton.hidden = true;
    setStatus("Bei Puter angemeldet. Gratis-Modelle werden geladen.");
    await loadPuterModels();
    updateProviderControls();
  } catch (error) {
    setStatus(`Puter-Anmeldung fehlgeschlagen: ${error.message}`, true);
  } finally {
    puterLoginButton.disabled = false;
  }
});

providerSelect.addEventListener("focus", () => {
  loadPuterModels();
});

updatesButton.addEventListener("click", async () => {
  updatesButton.disabled = true;
  setStatus("Suche nach Updates ...");
  try {
    const result = await window.chatApp.checkForUpdates();
    if (result.status === "dev") {
      setStatus("Updates sind im Entwicklungsmodus nicht verfügbar.");
    }
  } catch (error) {
    setStatus(error.message || "Die Update-Prüfung ist fehlgeschlagen.", true);
  } finally {
    updatesButton.disabled = false;
  }
});

configureVoiceInput();
updateProviderControls();
loadPuterSdk()
  .then(async (puter) => {
    puterSignedIn = await puter.auth.isSignedIn();
    updateProviderControls();
  })
  .catch((error) => {
    console.error("Puter-Ausweichanbieter konnte nicht vorbereitet werden.", error);
  });
window.chatApp.onUpdateStatus((update) => {
  switch (update.status) {
    case "checking":
      setStatus("Suche nach Updates ...");
      break;
    case "available":
      setStatus(`Version ${update.version} gefunden. Update wird geladen ...`);
      break;
    case "downloading":
      setStatus(`Update wird geladen: ${update.percent}%`);
      break;
    case "downloaded":
      setStatus(`Version ${update.version} ist bereit und wird beim Beenden installiert.`);
      break;
    case "current":
      setStatus("Du verwendest die aktuelle Version.");
      break;
    case "error":
      setStatus(`Update-Prüfung fehlgeschlagen: ${update.message}`, true);
      break;
    default:
      break;
  }
});

renderMessages();
promptInput.focus();
