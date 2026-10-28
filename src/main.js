const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

const CHAT_ENDPOINT = "https://text.pollinations.ai/";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 12000;

let mainWindow;

function hasUpdateFeed() {
  return fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    minWidth: 360,
    minHeight: 540,
    backgroundColor: "#111318",
    title: "Gratis KI Chat",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updates:status", status);
  }
}

ipcMain.handle("chat:send", async (_event, messages) => {
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    messages.some(
      (message) =>
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        message.content.length === 0 ||
        message.content.length > MAX_MESSAGE_LENGTH
    )
  ) {
    throw new Error("Die Chat-Nachrichten sind ungueltig oder zu lang.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Du bist ein hilfreicher KI-Assistent. Antworte klar und auf Deutsch, ausser der Nutzer wuenscht eine andere Sprache."
          },
          ...messages
        ]
      }),
      signal: controller.signal
    });

    const answer = (await response.text()).trim();
    if (!response.ok) {
      if (response.status === 402) {
        throw new Error(
          "Der kostenlose Dienst ist gerade ausgelastet. Bitte warte mindestens 30 Sekunden und versuche es erneut."
        );
      }
      throw new Error(
        `Der KI-Dienst antwortete mit HTTP ${response.status}: ${answer.slice(0, 300)}`
      );
    }
    if (!answer) {
      throw new Error("Der KI-Dienst hat eine leere Antwort zurueckgegeben.");
    }

    return answer;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
});

ipcMain.handle("updates:check", async () => {
  if (!app.isPackaged) {
    return { status: "dev" };
  }
  if (!hasUpdateFeed()) {
    return { status: "unconfigured" };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) {
      return { status: "unavailable" };
    }
    return { status: "checking" };
  } catch (error) {
    sendUpdateStatus({
      status: "error",
      message: error.message
    });
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ status: "checking" });
  });
  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({
      status: "available",
      version: info.version
    });
  });
  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus({ status: "current" });
  });
  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus({
      status: "downloading",
      percent: Math.round(progress.percent)
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({
      status: "downloaded",
      version: info.version
    });
  });
  autoUpdater.on("error", (error) => {
    sendUpdateStatus({
      status: "error",
      message: error.message
    });
  });

  if (app.isPackaged && hasUpdateFeed()) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        sendUpdateStatus({
          status: "error",
          message: error.message
        });
      });
    }, 5000);
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((error) => {
        sendUpdateStatus({
          status: "error",
          message: error.message
        });
      });
    }, 6 * 60 * 60 * 1000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
