const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("StoreCommandCenter", {
  platform: process.platform,
  desktop: true,
  offlineModeSupported: true,
});
