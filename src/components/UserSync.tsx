"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    upsertUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? undefined,
    }).catch(console.error);
  }, [isAuthenticated, user, upsertUser]);

  return null;
}
