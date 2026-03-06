function isLikelyDbObjectId(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
}

function normalizeRole(value) {
  if (value === "seeker" || value === "provider" || value === "admin") {
    return value;
  }
  return null;
}

async function resolveRealtimeUserFromToken(token, dependencies) {
  const tokenRole = normalizeRole(token?.role);
  if (isLikelyDbObjectId(token?.id) && tokenRole) {
    return {
      id: token.id,
      email: typeof token?.email === "string" ? token.email : "",
      role: tokenRole,
    };
  }

  if (typeof token?.email !== "string" || token.email.trim().length === 0) {
    return null;
  }

  const dbUser = await dependencies.findUserByEmail(token.email);
  const dbRole = normalizeRole(dbUser?.role);

  if (!isLikelyDbObjectId(dbUser?._id) || !dbRole) {
    return null;
  }

  return {
    id: dbUser._id,
    email: typeof dbUser.email === "string" ? dbUser.email : token.email,
    role: dbRole,
  };
}

function canAccessComplaintConversation(input) {
  const complaintStatus = input.complaint.status || "open";
  const isAdmin = input.actorRole === "admin";
  const isSeeker = input.complaint.seekerId === input.actorId;
  const isProvider = input.complaint.providerId === input.actorId;

  if (
    (complaintStatus === "resolved" || complaintStatus === "rejected") &&
    !isAdmin
  ) {
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

async function authorizeBookingRoom(input, dependencies) {
  const bookingId = typeof input?.bookingId === "string" ? input.bookingId : "";
  if (!isLikelyDbObjectId(bookingId)) {
    return { ok: false, error: "Invalid booking id" };
  }

  const booking = await dependencies.findBookingById(bookingId);
  if (!booking) {
    return { ok: false, error: "Booking not found" };
  }

  if (
    booking.seeker_id !== input.user.id &&
    booking.provider_id !== input.user.id
  ) {
    return { ok: false, error: "Forbidden" };
  }

  return {
    ok: true,
    room: `booking:${bookingId}`,
  };
}

async function authorizeComplaintRoom(input, dependencies) {
  const complaintId =
    typeof input?.complaintId === "string" ? input.complaintId : "";
  if (!isLikelyDbObjectId(complaintId)) {
    return { ok: false, error: "Invalid complaint id" };
  }

  const complaint = await dependencies.findComplaintById(complaintId);
  if (!complaint) {
    return { ok: false, error: "Complaint not found" };
  }

  const decision = canAccessComplaintConversation({
    actorId: input.user.id,
    actorRole: input.user.role,
    complaint,
  });

  if (!decision.allowed) {
    return { ok: false, error: decision.error };
  }

  return {
    ok: true,
    room: `complaint:${complaintId}`,
  };
}

async function authorizeOrderRoom(input, dependencies) {
  const orderId = typeof input?.orderId === "string" ? input.orderId : "";
  if (!isLikelyDbObjectId(orderId)) {
    return { ok: false, error: "Invalid order id" };
  }

  const order = await dependencies.findOrderById(orderId);
  if (!order) {
    return { ok: false, error: "Order not found" };
  }

  const isAdmin = input.user.role === "admin";
  if (
    !isAdmin &&
    order.seeker_id !== input.user.id &&
    order.provider_id !== input.user.id
  ) {
    return { ok: false, error: "Forbidden" };
  }

  return {
    ok: true,
    room: `order:${orderId}`,
  };
}

module.exports = {
  authorizeBookingRoom,
  authorizeComplaintRoom,
  authorizeOrderRoom,
  canAccessComplaintConversation,
  isLikelyDbObjectId,
  resolveRealtimeUserFromToken,
};
