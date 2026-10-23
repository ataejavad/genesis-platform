import { permanentRedirect } from "next/navigation";

// The industries list became Explore (doc 15 §6ه.2).
export default async function Industries({ params }: { params: Promise<{ locale: string }> }) {
  permanentRedirect(`/${(await params).locale}/explore`);
}
