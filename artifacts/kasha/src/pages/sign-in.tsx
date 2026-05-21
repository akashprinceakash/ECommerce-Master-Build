import { SignIn } from "@clerk/react";
import { useSearch } from "wouter";
import { Layout } from "@/components/layout/Layout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const search = useSearch();
  const redirectUrl = new URLSearchParams(search).get("redirect_url") ?? undefined;

  return (
    <Layout>
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 bg-background">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={redirectUrl ?? `${basePath}/`}
          forceRedirectUrl={redirectUrl}
        />
      </div>
    </Layout>
  );
}
