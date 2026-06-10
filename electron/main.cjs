const { app, BrowserWindow, dialog, shell } = require("electron");
const { fork } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const APP_URL = process.env.ELECTRON_START_URL || "http://127.0.0.1:3000";
const PORT = Number(process.env.PORT || "3000");
let mainWindow;
let nextProcess;

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function attempt() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(attempt, 500);
      });

      request.setTimeout(1000, () => {
        request.destroy();
      });
    }

    attempt();
  });
}

function standaloneRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone");
  }

  return path.join(__dirname, "..", ".next", "standalone");
}

async function startLocalBackend() {
  if (process.env.ELECTRON_START_URL) {
    return;
  }

  const serverPath = path.join(standaloneRoot(), "server.js");

  nextProcess = fork(serverPath, {
    cwd: standaloneRoot(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      PORT: String(PORT),
    },
    stdio: "ignore",
  });

  nextProcess.unref();
  await waitForServer(APP_URL);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    title: "StoreCommandCenter",
    backgroundColor: "#f4f7fb",
    show: false,
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(APP_URL);
}

app.whenReady().then(async () => {
  try {
    await startLocalBackend();
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "StoreCommandCenter failed to start",
      error instanceof Error ? error.message : "Unable to start local backend.",
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
});
