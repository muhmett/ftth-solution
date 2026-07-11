import { clearSessionCookie, apiHandler } from '@/lib/auth';

export const POST = apiHandler(async () => {
  clearSessionCookie();
  return Response.json({ ok: true });
});
