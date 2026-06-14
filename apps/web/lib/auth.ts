/**
 * Auth helper for the (app) route group.
 * Server component: reads the arbor_access cookie, redirects to /login if absent.
 *
 * In production this is also where you'd verify the JWT signature (using jose).
 * For Phase 0, the Worker sets the cookie; Pages trusts it because both run
 * on the same domain. Cross-origin (api.arborstudio.com + arborstudio.pages.dev)
 * uses httpOnly + Secure + SameSite=Lax.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function authRedirect(): Promise<void> {
  const cookieStore = await cookies();
  const access = cookieStore.get('arbor_access');
  if (!access) redirect('/login');
}
