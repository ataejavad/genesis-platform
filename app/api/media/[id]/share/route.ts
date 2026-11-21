import { getDb } from "@/db";
import { shareUrlOf } from "@/server/media";

// One tap from the founder's phone: opens LinkedIn with the approved post already written (SOCIAL_PROVIDER=manual).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = await shareUrlOf(getDb(), id);
  if (!url) return new Response("This post is not ready to share.", { status: 404 });
  return Response.redirect(url, 302);
}
