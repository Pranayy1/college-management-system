import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { StatusBar } from "@capacitor/status-bar";
import { Browser } from "@capacitor/browser";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

/* ===================== Theme Bootstrap ===================== */

const applyTheme = () => {
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) {
        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    } else {
        // Fallback to system preference
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (prefersDark) {
            document.documentElement.classList.add("dark");
        }
    }
};

applyTheme();
if (Capacitor.isNativePlatform()) {
    StatusBar.hide();
}

if (Capacitor.isNativePlatform()) {

    const handleOAuth = async (url) => {

        if (!url || !url.includes("oauth-success")) return;

        console.log("Deep link:", url);

        // Close Google browser
        await Browser.close();

        const parsed = new URL(url);

        const token = parsed.searchParams.get("token");
        const role = parsed.searchParams.get("role");

        if (token) {
            localStorage.setItem("token", token);
            localStorage.setItem("role", role);

            window.location.replace("/oauth-success");
        }
    };

    // App already running
    CapacitorApp.addListener("appUrlOpen", (event) => {
        handleOAuth(event.url);
    });

    // App launched from deep link
    CapacitorApp.getLaunchUrl().then((data) => {
        if (data?.url) {
            handleOAuth(data.url);
        }
    });

}
/* ===================== Render ===================== */

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>
);