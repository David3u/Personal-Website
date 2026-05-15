import { getLinkBySlug } from "@/lib/links/store";
import { redirect } from "next/navigation";

interface ShortLinkPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ShortLinkPage({ params }: ShortLinkPageProps) {
  const { slug } = await params;
  const link = await getLinkBySlug(slug);

  if (!link) {
    redirect("/");
  }

  redirect(link.targetUrl);
}
