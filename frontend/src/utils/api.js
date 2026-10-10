import axios from "axios";
import { Capacitor } from "@capacitor/core";

// Browser builds use same-origin routing.
// Electron and Android need an absolute backend URL.
const isElectron =
    typeof window !== "undefined" &&
    window.location.protocol === "file:";

const isNative = Capacitor.isNativePlatform();
const configuredBackend = import.meta.env.VITE_BACKEND?.trim();

const isLocalBackend =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(
        configuredBackend || ""
    );

// Never use localhost in a production build.
const useConfiguredBackend =
    Boolean(configuredBackend) &&
    !(import.meta.env.PROD && isLocalBackend);

const baseURL = useConfiguredBackend
    ? configuredBackend
    : (isElectron || isNative)
        ? "https://cms-beryl-seven.vercel.app"
        : "";

const api = axios.create({
    baseURL,
    withCredentials: true,
});

export default api;