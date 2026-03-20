"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Ban, Trash2 } from "lucide-react";

const MENU_WIDTH = 224;
const MENU_ITEM_HEIGHT = 48;
const MENU_VERTICAL_PADDING = 8;
const VIEWPORT_PADDING = 12;
const subscribe = () => () => {};

type ChatDeleteMenuProps = {
  x: number;
  y: number;
  deleting?: boolean;
  onClose: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
};

function getMenuPosition(
  x: number,
  y: number,
  optionCount: number,
): { left: number; top: number } {
  if (typeof window === "undefined") {
    return { left: x, top: y };
  }

  const menuHeight = optionCount * MENU_ITEM_HEIGHT + MENU_VERTICAL_PADDING;

  return {
    left: Math.max(
      VIEWPORT_PADDING,
      Math.min(x, window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING),
    ),
    top: Math.max(
      VIEWPORT_PADDING,
      Math.min(y, window.innerHeight - menuHeight - VIEWPORT_PADDING),
    ),
  };
}

export function ChatDeleteMenu({
  x,
  y,
  deleting = false,
  onClose,
  onDeleteForMe,
  onDeleteForEveryone,
}: ChatDeleteMenuProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return null;
  }

  const optionCount = 1 + (onDeleteForEveryone ? 1 : 0);
  const position = getMenuPosition(x, y, optionCount);

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border/70 bg-card/95 py-1 shadow-2xl shadow-black/25 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        style={position}
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          onClick={onDeleteForMe}
          disabled={deleting}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
            <Trash2 className="h-4 w-4" />
          </span>
          <span className="flex-1 whitespace-nowrap leading-none">
            Delete for me
          </span>
        </button>

        {onDeleteForEveryone && (
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            onClick={onDeleteForEveryone}
            disabled={deleting}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <Ban className="h-4 w-4" />
            </span>
            <span className="flex-1 whitespace-nowrap leading-none">
              Delete for everyone
            </span>
          </button>
        )}
      </div>
    </>,
    document.body,
  );
}
