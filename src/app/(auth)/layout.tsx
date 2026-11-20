import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-leaf-900 lg:block">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "repeating-linear-gradient(-12deg, #9fc497 0 2px, transparent 2px 28px)" }} />
        <div className="relative flex h-full flex-col justify-between p-12 text-leaf-50">
          <Link href="/"><Logo light /></Link>
          <div>
            <p className="font-display text-4xl leading-tight">Every spray, every wage,<br />every sale — remembered.</p>
            <p className="mt-4 max-w-md text-leaf-200">A farm diary, labour book and account book built for the arecanut, coconut and paddy farms of coastal Karnataka. Works on a weak connection.</p>
          </div>
          <p className="text-sm text-leaf-300">ನಿಮ್ಮ ಕೃಷಿ, ಒಂದೇ ಕಡೆ</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          {children}
        </div>
      </div>
    </div>
  );
}
