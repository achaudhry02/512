import { AppShell } from "@/components/app-shell";
import { CommandCenterProvider } from "@/lib/data-provider";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CommandCenterProvider>
      <AppShell>{children}</AppShell>
    </CommandCenterProvider>
  );
}
