import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { storage } from "../../utils/storage";
import LoadingSpinner from "../Common/LoadingSpinner";

/**
 * Handles the browser auth flow via one-time session token.
 * URL: /auth/session/:sessionToken
 * Exchanges the token for a JWT and redirects to /bookings.
 */
export default function SessionAuthPage() {
  const { sessionToken } = useParams<{ sessionToken: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const authenticate = async () => {
      if (!sessionToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await authApi.consumeSession(sessionToken);
        storage.setToken(res.access_token);
        sessionStorage.setItem("__corpmeet_replay_splash", "1");
        navigate("/bookings", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };

    authenticate();
  }, [sessionToken, navigate]);

  return <LoadingSpinner />;
}
