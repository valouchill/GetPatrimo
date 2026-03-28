import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import AgentConciergeClient from "./AgentConciergeClient";

export const metadata = {
  title: "Agent Expert — PatrimoTrust™",
  description: "Agent IA conversationnel pour la collecte de votre bien",
};

export default async function ConciergePage() {
  const session: any = await getServerSession(authOptions as any);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/concierge");
  }
  return <AgentConciergeClient />;
}
