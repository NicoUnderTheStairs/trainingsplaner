import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "android" | "ios" | "unsupported";

interface InstallPromptState {
  platform: InstallPlatform;
  canInstall: boolean;
  isInstalled: boolean;
  triggerInstall: () => Promise<void>;
  dismiss: () => void;
  isDismissed: boolean;
}

const DISMISSED_KEY = "pwa-install-dismissed";

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroidChrome =
    /android/i.test(ua) && /chrome/i.test(ua) && !/edg/i.test(ua);
  const isEdgeMobile = /android/i.test(ua) && /edg/i.test(ua);

  if (isIos) return "ios";
  if (isAndroidChrome || isEdgeMobile) return "android";
  return "unsupported";
}

function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );

  const platform = detectPlatform();
  const isInstalled = isRunningStandalone();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const canInstall =
    !isInstalled &&
    !isDismissed &&
    (platform === "ios" || deferredPrompt !== null);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  return { platform, canInstall, isInstalled, triggerInstall, dismiss, isDismissed };
}
