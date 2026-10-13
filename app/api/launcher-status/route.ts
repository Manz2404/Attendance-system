export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  // Identify this application without exposing configuration or requiring database access.
  return Response.json({ application: 'hadir-attendance' }, { headers: { 'Cache-Control': 'no-store' } });
}
