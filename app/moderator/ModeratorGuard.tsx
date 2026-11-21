'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, enforceSessionExpiry } from '@/lib/supabase';

export default function ModeratorGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const params =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : null;
        const roomParam = (params?.get('room') || '').trim();
        const joinParam = (params?.get('join') || '').trim();

        // Tillåt inbjuden motpart utan konto/Premium när giltig rumskod eller join-flagga anges
        if (/^[A-Za-z0-9_-]{4,16}$/.test(roomParam) || joinParam === '1') {
          if (active) {
            setAuthorized(true);
          }
          return;
        }

        await enforceSessionExpiry();

        const {
          data: { session },
        } = await supabase.auth.getSession();

        let user = session?.user ?? null;

        if (!user) {
          const {
            data: { user: fetchedUser },
            error: authError,
          } = await supabase.auth.getUser();
          if (!authError && fetchedUser) {
            user = fetchedUser;
          }
        }

        if (!user) {
          if (active) router.replace('/');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('is_premium')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError || !profile?.is_premium) {
          if (active) router.replace('/');
          return;
        }

        if (active) {
          setAuthorized(true);
        }
      } catch {
        if (active) router.replace('/');
      }
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E8DCC4] text-[#1F241D]">
        <p className="text-sm tracking-wide opacity-75">
          Förbereder samtalsrum...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
