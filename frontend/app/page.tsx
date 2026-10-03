'use client';

import { Redirect } from '@/components/Redirect';
import { lastWorkspaceHome } from '@/lib/workspace';

/** Bosh manzil — oxirgi ochilgan bo'limga (birinchi marta: Instagram) */
export default function Home() {
  return <Redirect to={lastWorkspaceHome} />;
}
