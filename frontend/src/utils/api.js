import axios from "axios";
import { Capacitor } from "@capacitor/core";

const isNativeApp =
    typeof window !== "undefined" &&
    (Capacitor.isNativePlatform() || /electron/i.test(window.navigator.userAgent));

const api = axios.create({
    baseURL: isNativeApp ? import.meta.env.VITE_BACKEND : "",
    withCredentials: true,
});

export default api;