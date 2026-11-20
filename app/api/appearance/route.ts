import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { userAppearance } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { normalizeAppearance } from '@/lib/appearance';
import { allowedOrigin, readJSON, RequestError } from '@/lib/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Please sign in.' }, 401);
    const [row] = await getDb().select().from(userAppearance).where(eq(userAppearance.userId, user.userId)).limit(1);
    return json({ settings: row ? normalizeAppearance(JSON.parse(row.settings)) : null });
  } catch { return json({ error: 'Could not load your saved appearance. Please reload to retry.' }, 500); }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Please sign in again to save your appearance.' }, 401);
    if (!allowedOrigin(request)) return json({ error: 'This request is not allowed.' }, 403);
    const body = await readJSON(request, 4096);
    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) return json({ error: 'Invalid appearance settings.' }, 400);
    const settings = normalizeAppearance(body.settings);
    // Account preferences must not change when another device uses a different OS mode.
    if (settings.mode === 'system') return json({ error: 'Choose light or dark mode before saving.' }, 400);
    const values = { settings: JSON.stringify(settings), updatedAt: new Date().toISOString() };
    await getDb().insert(userAppearance).values({ userId: user.userId, ...values }).onDuplicateKeyUpdate({ set: values });
    return json({ settings });
  } catch (error) {
    return json({ error: error instanceof RequestError ? error.message : 'Could not save your appearance. Your saved settings have not changed. Please retry.' }, error instanceof RequestError ? error.status : 500);
  }
}
