import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin(eventId: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancel = false;

    const check = async (uid: string | null) => {
      if (!uid || !eventId) {
        if (!cancel) {
          setIsAdmin(false);
          setChecked(true);
        }
        return;
      }
      const { data } = await supabase
        .from("event_admins")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!cancel) {
        setIsAdmin(!!data);
        setChecked(true);
      }
    };

    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      void check(uid);
    });

    // Then current session
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      void check(uid);
    });

    return () => {
      cancel = true;
      sub.subscription.unsubscribe();
    };
  }, [eventId]);

  return { isAdmin, userId, checked };
}