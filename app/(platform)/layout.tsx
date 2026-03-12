import ConditionalHeader from "../components/ConditionalHeader";
import ConditionalMain from "../components/ConditionalMain";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full">
      <ConditionalHeader />
      <ConditionalMain>{children}</ConditionalMain>
    </div>
  );
}
