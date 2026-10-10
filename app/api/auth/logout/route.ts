import { destroySession } from '@/lib/auth';
import { allowedOrigin } from '@/lib/request';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!allowedOrigin(request)) return Response.json({ error: 'This request is not allowed.' }, { status: 403 });
  try { await destroySession(); return Response.json({ message: 'Signed out.' }); }
  catch { return Response.json({ error: 'Could not sign out. Please try again.' }, { status: 500 }); }
}
