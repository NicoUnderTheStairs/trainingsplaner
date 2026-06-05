import React from "react";
import { useInstallPrompt } from "../../../hooks/useInstallPrompt";
import "./_installbanner.scss";

const InstallBanner: React.FC = () => {
  const { platform, canInstall, triggerInstall, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="install-banner" role="banner" aria-label="Add to Home Screen">
      <div className="install-banner__icon" aria-hidden="true">
        <img src="/web-app-manifest-192x192.png" alt="" />
      </div>

      <div className="install-banner__content">
        <p className="install-banner__title">Add to Home Screen</p>
        {platform === "ios" ? (
          <p className="install-banner__hint">
            Tap <span className="install-banner__hint__icon">&#x2BAD;</span> then
            &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p className="install-banner__hint">Use the app — fast &amp; offline</p>
        )}
      </div>

      <div className="install-banner__actions">
        {platform !== "ios" && (
          <button
            className="install-banner__btn install-banner__btn--install"
            onClick={triggerInstall}
          >
            Install
          </button>
        )}
        <button
          className="install-banner__btn install-banner__btn--dismiss"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
