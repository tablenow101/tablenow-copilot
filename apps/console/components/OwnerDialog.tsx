"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function OwnerDialog({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="tn-modal tn-app"
      ref={ref}
      aria-labelledby="owner-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2 id="owner-dialog-title">{title}</h2>
        <button
          className="tn-icon"
          onClick={close}
          disabled={busy}
          aria-label="Fermer"
        >
          <X size={20} />
        </button>
      </header>
      <div className="tn-modal-body">{children}</div>
    </dialog>
  );
}
