import { revalidatePath } from "next/cache";

// Called after a page is published so the public site and agent layer show it at once.
export function revalidatePublished(content: { locale: string; slug: string; status: string }) {
  if (content.status !== "published") return;
  revalidatePath(`/${content.locale}/${content.slug}`);
  revalidatePath(`/${content.locale}`);
}
