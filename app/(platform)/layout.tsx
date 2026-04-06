import ConditionalHeader from "../components/ConditionalHeader";
import ConditionalMain from "../components/ConditionalMain";
import CookieBanner from "../components/CookieBanner";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full">
      <ImpersonationBanner />
      <ConditionalHeader />
      <ConditionalMain>{children}</ConditionalMain>
      <CookieBanner />
    </div>
  );
}
