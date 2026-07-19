import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CurrentUser = {
  user: User | null;
  displayName: string;
  firstName: string;
  initials: string;
  email: string;
};

function derive(user: User | null): CurrentUser {
  if (!user) {
    return { user: null, displayName: "Guest", firstName: "there", initials: "?", email: "" };
  }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (meta.display_name as string) ||
    (meta.user_name as string) ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Member";
  const displayName = raw.trim();
  const firstName = displayName.split(/[\s._-]+/)[0] || displayName;
  const parts = displayName.split(/[\s._-]+/).filter(Boolean);
  const initials =
    (parts[0]?.[0] ?? "?").toUpperCase() +
    (parts[1]?.[0] ?? "").toUpperCase();
  return { user, displayName, firstName, initials, email: user.email ?? "" };
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>(() => derive(null));

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setState(derive(data.user ?? null));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setState(derive(session?.user ?? null));
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
