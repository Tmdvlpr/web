import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { storage } from "../../utils/storage";
import { useTelegram } from "../../hooks/useTelegram";
import LoadingSpinner from "../Common/LoadingSpinner";

/**
 * Entry point for unauthenticated users.
 *
 * In Mini App:
 *   - Tries to silently login via initData
 *   - If user not registered → redirect to /register
 *   - If login fails → redirect to /register
 *
 * In browser (no Mini App):
 *   - Session token handling is in /auth/session/:token
 *   - Without a session → show "Open in Telegram" message
 */
export default function LoginPage() {
  const { isMiniApp, initData } = useTelegram();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMiniApp) return;

    const tryLogin = async () => {
      try {
        const res = await authApi.login(initData);
        storage.setToken(res.access_token);
        navigate("/bookings", { replace: true });
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          // Not registered yet
          navigate("/register", { replace: true });
        } else {
          // initData invalid or expired — still try to register
          navigate("/register", { replace: true });
        }
      }
    };

    tryLogin();
  }, [isMiniApp, initData, navigate]);

  if (isMiniApp) {
    return <LoadingSpinner />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="text-center p-10 rounded-3xl max-w-sm"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="text-5xl mb-4">📱</div>
        <h1
          className="text-xl font-bold mb-2"
          style={{ color: "var(--text)" }}
        >
          Откройте в Telegram
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Войдите через мини-приложение Telegram, затем нажмите «Открыть в
          браузере» для работы в браузере.
        </p>
      </div>
    </div>
  );
}
