"use client";

import { useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import { isDeviceIdPersistent } from "@/lib/device";

const noopSubscribe = () => () => {};

export function StorageNotice() {
  // Server render assumes storage works; the browser reports the real state.
  const persistent = useSyncExternalStore(
    noopSubscribe,
    isDeviceIdPersistent,
    () => true,
  );

  if (persistent) return null;

  return (
    <div className="mx-auto mt-4 flex max-w-6xl items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Your browser is blocking storage, so expenses won&apos;t be saved after
        you close this page. Open this link in Chrome or Safari to keep them.
      </p>
    </div>
  );
}
