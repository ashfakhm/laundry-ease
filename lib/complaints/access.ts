const ONGOING_COMPLAINT_STATUSES = new Set(["open", "accepted", "in_review"]);
const FINALIZED_COMPLAINT_STATUSES = new Set(["resolved", "rejected"]);

export type ComplaintAccessRole = "admin" | "seeker" | "provider";

type ComplaintAccessInput = {
  actorId: string;
  actorRole: string;
  complaint: {
    seekerId: string;
    providerId: string;
    providerAccessGranted?: boolean;
    status?: string;
  };
};

type ComplaintAccessDecision =
  | {
      allowed: true;
      role: ComplaintAccessRole;
    }
  | {
      allowed: false;
      error: string;
    };

export function isComplaintOngoing(status: string | undefined): boolean {
  return Boolean(status && ONGOING_COMPLAINT_STATUSES.has(status));
}

export function canAccessComplaintConversation(
  input: ComplaintAccessInput,
): ComplaintAccessDecision {
  const actorRole = input.actorRole;
  const complaintStatus = input.complaint.status || "open";
  const isAdmin = actorRole === "admin";
  const isSeeker = input.complaint.seekerId === input.actorId;
  const isProvider = input.complaint.providerId === input.actorId;

  if (FINALIZED_COMPLAINT_STATUSES.has(complaintStatus) && !isAdmin) {
    return {
      allowed: false,
      error: "Dispute is resolved. Access is restricted to Admin only.",
    };
  }

  if (isAdmin) {
    return { allowed: true, role: "admin" };
  }

  if (isSeeker) {
    return { allowed: true, role: "seeker" };
  }

  if (isProvider) {
    if (!input.complaint.providerAccessGranted) {
      return { allowed: false, error: "Provider access has not been granted." };
    }
    return { allowed: true, role: "provider" };
  }

  return { allowed: false, error: "Forbidden" };
}
