import { app, BrowserWindow, shell, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setPath("userData", path.join(os.homedir(), ".college-management-system"));
let mainWindow;

/* ================= Resolve React Build ================= */

function getIndexPath() {

    if (app.isPackaged) {
        return path.join(process.resourcesPath, "app.asar", "release", "index.html");
    }

    return path.join(__dirname, "../release/index.html");
}

/* ================= OAuth Handler ================= */

function handleOAuth(url) {

    try {

        const parsed = new URL(url);
        const token = parsed.searchParams.get("token");
        const role = parsed.searchParams.get("role");

        if (!token || !role) return;

        const indexPath = getIndexPath();

        mainWindow.loadFile(indexPath, { hash: "/" }).then(() => {

            mainWindow.webContents.executeJavaScript(`
                localStorage.setItem("token","${token}");
                localStorage.setItem("role","${role}");
                window.location.hash="/oauth-success";
            `);

        });

    } catch (err) {
        console.error("OAuth handling error:", err);
    }

}

/* ================= Create Window ================= */

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: "#ffffff",
        icon: path.join(__dirname, "icon.png"),
        titleBarStyle: "hiddenInset",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.js")
        }
    });
    mainWindow.removeMenu();

    const indexPath = getIndexPath();

    mainWindow.loadFile(indexPath, { hash: "/" });

    const wc = mainWindow.webContents;

    wc.on("will-redirect", (event, url) => {

        if (url.includes("/oauth-success")) {
            event.preventDefault();
            handleOAuth(url);
        }

    });

    wc.on("will-navigate", (event, url) => {

        if (url.includes("/oauth-success")) {
            event.preventDefault();
            handleOAuth(url);
        }

    });

    wc.setWindowOpenHandler(({ url }) => {

        if (url.includes("/oauth-success")) {
            handleOAuth(url);
            return { action: "deny" };
        }

        shell.openExternal(url);
        return { action: "deny" };

    });

}

/* ================= Electron Print Handler ================= */

ipcMain.handle("print-marksheet", () => {

    try {

        const win = BrowserWindow.getFocusedWindow() || mainWindow;

        if (!win) return;

        win.webContents.print({
            silent: false,
            printBackground: true,
            margins: {
                marginType: "default"
            }
        });

    } catch (err) {
        console.error("Print error:", err);
    }

});

/* ================= App Lifecycle ================= */
app.whenReady().then(createWindow);

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});