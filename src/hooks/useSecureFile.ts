import { useEffect, useState } from "react";

// Player/coach ID files are stored as relative "keys" (e.g.
// "teams/{teamId}/{name}.{ext}") and can only be retrieved through
// download.php with a valid access token — they are not public URLs.
// This fetches the file as a blob and exposes it as an object URL.
// Object URLs are cached by key so multiple components sharing the same
// file reuse a single request.

const objectUrlCache = new Map<string, Promise<string>>();

const fetchSecureFileUrl = (key: string): Promise<string> => {
  let cached = objectUrlCache.get(key);
  if (!cached) {
    cached = (async () => {
      const base = import.meta.env.VITE_DOWNLOAD_URL as string;
      const res = await fetch(`${base}?path=${encodeURIComponent(key)}`, {
        headers: {
          "X-Download-Token": import.meta.env.VITE_UPLOAD_TOKEN as string,
        },
      });
      if (!res.ok) throw new Error("Failed to load file");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    })();
    cached.catch(() => objectUrlCache.delete(key));
    objectUrlCache.set(key, cached);
  }
  return cached;
};

export const isPdfKey = (key?: string | null) =>
  !!key && key.toLowerCase().endsWith(".pdf");

// Returns a blob: object URL for a secure file key, or null while loading/on error.
export function useSecureFile(key?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setUrl(null);
    fetchSecureFileUrl(key)
      .then((objectUrl) => {
        if (!cancelled) setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { url, loading };
}
