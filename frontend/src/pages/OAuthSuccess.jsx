import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";

const OAuthSuccess = () => {

    const navigate = useNavigate();

    useEffect(() => {

        const params = new URLSearchParams(window.location.search);

        const token = params.get("token");
        const role = params.get("role");

        /* ===== Token present in URL (Google redirect) ===== */

        if (token && role) {

            localStorage.setItem("token", token);
            localStorage.setItem("role", role);

            // remove token from URL
            window.history.replaceState({}, document.title, "/oauth-success");

            redirectByRole(role);
            return;
        }

        /* ===== Otherwise try session cookie ===== */

        api.get("/api/auth/session")
            .then((res) => {

                const { token, role } = res.data;

                if (!token || !role) {
                    navigate("/", { replace: true });
                    return;
                }

                localStorage.setItem("token", token);
                localStorage.setItem("role", role);

                redirectByRole(role);

            })
            .catch(() => {
                navigate("/", { replace: true });
            });

    }, [navigate]);

    const redirectByRole = (role) => {

        if (role === "admin") {
            navigate("/admin/dashboard", { replace: true });
        }
        else if (role === "faculty") {
            navigate("/faculty/dashboard", { replace: true });
        }
        else if (role === "student") {
            navigate("/student/dashboard", { replace: true });
        }
        else {
            navigate("/", { replace: true });
        }

    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Signing you in...</p>
        </div>
    );

};

export default OAuthSuccess;