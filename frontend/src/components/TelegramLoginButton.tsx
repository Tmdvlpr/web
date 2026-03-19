import { useEffect, useRef } from "react";
import type { TelegramUser } from "../types";

interface TelegramLoginButtonProps {
  onAuth: (user: TelegramUser) => void;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export function TelegramLoginButton({ onAuth }: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME ?? "";

  useEffect(() => {
    if (!containerRef.current) return;

    window.onTelegramAuth = onAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [onAuth, botName]);

  return <div ref={containerRef} className="flex justify-center" />;
}
