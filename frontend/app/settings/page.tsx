'use client';

import { Redirect } from '@/components/Redirect';

/** Eski manzil (eski OAuth havolalari ?ig=... bilan ham shu yerga keladi) */
export default function OldSettings() {
  return <Redirect to="/instagram/settings" />;
}
