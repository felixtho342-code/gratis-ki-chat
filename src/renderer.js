const chat = document.getElementById("chat");
const messagesElement = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const composer = document.getElementById("composer");
const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send-button");
const statusElement = document.getElementById("status");
const clearButton = document.getElementById("clear-button");
const updatesButton = document.getElementById("updates-button");

const STORAGE_KEY = "gratis-ki-chat-messages";
let messages = loadMessages();
let busy = false;

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
    const answer = await window.chatApp.sendMessage(requestMessages);
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

updatesButton.addEventListener("click", async () => {
  updatesButton.disabled = true;
  setStatus("Suche nach Updates ...");
  try {
    const result = await window.chatApp.checkForUpdates();
    if (result.status === "dev") {
      setStatus("Updates sind im Entwicklungsmodus nicht verfügbar.");
    } else if (result.status === "unconfigured") {
      setStatus("Updates werden aktiviert, sobald ein Release im Projekt-Repository veröffentlicht ist.");
    }
  } catch (error) {
    setStatus(error.message || "Die Update-Prüfung ist fehlgeschlagen.", true);
  } finally {
    updatesButton.disabled = false;
  }
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
