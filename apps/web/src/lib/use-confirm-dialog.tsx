"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
  }, []);

  const close = useCallback(() => {
    if (!loading) setOptions(null);
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      setOptions(null);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={close}
    />
  );

  return { ask, dialog, close, pending: options !== null };
}
