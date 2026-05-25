import { SignUp } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const REDIRECT_KEY = "kasha_redirect_after_login";

function getRedirectUrl(): string {
  try {
    const stored = localStorage.getItem(REDIRECT_KEY);
    if (stored) return stored;
  } catch {}
  return `${basePath}/`;
}

export default function SignUpPage() {
  const redirectUrl = getRedirectUrl();

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 bg-background">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl={redirectUrl}
        />
      </div>
    </Layout>
  );
}
