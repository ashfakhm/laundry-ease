import realtimeContracts, {
  type ComplaintStateUpdateDto,
  type MessageDeletedDto,
} from "@/lib/realtime/contracts";

type MessageWithIdentity = {
  _id: string;
  createdAt: string;
};

type ComplaintSelfRole = "seeker" | "provider" | "admin";

export type ComplaintUiState = {
  isResolved: boolean;
  isAccessBlocked: boolean;
  error: string | null;
};

export function sortMessages<T extends MessageWithIdentity>(
  messages: T[],
): T[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      a._id.localeCompare(b._id),
  );
}

export function appendUniqueSortedMessages<T extends MessageWithIdentity>(
  existing: T[],
  incoming: T | T[],
): T[] {
  const next = new Map<string, T>(
    existing.map((message) => [message._id, message] as const),
  );
  const items = Array.isArray(incoming) ? incoming : [incoming];

  for (const message of items) {
    if (!message?._id) continue;
    next.set(message._id, message);
  }

  return sortMessages([...next.values()]);
}

export function isComplaintArchived(
  status: string | null | undefined,
): boolean {
  return status === "resolved" || status === "rejected";
}

export function deriveComplaintUiState(input: {
  selfRole: ComplaintSelfRole;
  status?: string | null;
  providerAccessGranted?: boolean | null;
}): ComplaintUiState {
  if (isComplaintArchived(input.status)) {
    return {
      isResolved: true,
      isAccessBlocked: input.selfRole !== "admin",
      error: "Dispute is resolved. Chat is archived.",
    };
  }

  if (input.selfRole === "provider" && input.providerAccessGranted === false) {
    return {
      isResolved: false,
      isAccessBlocked: true,
      error: "Provider access has not been granted.",
    };
  }

  return {
    isResolved: false,
    isAccessBlocked: false,
    error: null,
  };
}

export function deriveComplaintUiStateFromRealtime(
  update: ComplaintStateUpdateDto,
  selfRole: ComplaintSelfRole,
): ComplaintUiState {
  return deriveComplaintUiState({
    selfRole,
    status: update.status,
    providerAccessGranted: update.providerAccessGranted,
  });
}

export const { CLIENT_EVENTS, SERVER_EVENTS } = realtimeContracts;

/**
 * Handle a "message deleted" realtime event.
 * - for_everyone: marks the message as deletedForEveryone (shows placeholder)
 * - hard_delete: removes the message entirely from the list (no trace)
 */
export function applyMessageDeletion<
  T extends MessageWithIdentity & {
    deletedForEveryone?: boolean;
    message?: string;
    content?: string;
    attachments?: string[];
    voiceMessage?: string;
    voiceDurationMs?: number;
  },
>(messages: T[], payload: MessageDeletedDto): T[] {
  if (payload.mode === "hard_delete") {
    return messages.filter((m) => m._id !== payload.messageId);
  }

  // for_everyone — mark as deleted, strip content
  return messages.map((m) => {
    if (m._id !== payload.messageId) return m;
    return {
      ...m,
      deletedForEveryone: true,
      message: "",
      content: "",
      attachments: [],
      voiceMessage: "",
      voiceDurationMs: 0,
    };
  });
}

/**
 * Remove a message from the local list (used after "delete for me" succeeds).
 */
export function removeMessageLocally<T extends MessageWithIdentity>(
  messages: T[],
  messageId: string,
): T[] {
  return messages.filter((m) => m._id !== messageId);
}
