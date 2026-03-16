import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  return (
    <>
      <SignedIn>
        <RedirectToDashboard />
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </>
  );
}

function RedirectToDashboard() {
  redirect("/dashboard");
}

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
      <div className="space-y-4">
        <div className="text-6xl mb-4">💸</div>
        <h1 className="text-4xl font-bold text-gray-900">
          Take Control of Your Finances
        </h1>
        <p className="text-xl text-gray-500 max-w-lg">
          SuperBudget helps you track spending, set category limits, and get
          real-time alerts when you&apos;re close to your budget.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6 text-left max-w-2xl w-full">
        {[
          { icon: "📊", title: "Real-time tracking", desc: "See exactly where your money goes" },
          { icon: "🎯", title: "Budget categories", desc: "Set limits for every spending area" },
          { icon: "🚨", title: "Overspend alerts", desc: "Get notified before you go over" },
        ].map((feature) => (
          <div key={feature.title} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">{feature.icon}</div>
            <h3 className="font-semibold text-gray-800">{feature.title}</h3>
            <p className="text-sm text-gray-500">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="bg-indigo-600 text-white font-medium px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Get Started Free
        </Link>
        <Link
          href="/sign-in"
          className="bg-white text-gray-700 font-medium px-8 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
