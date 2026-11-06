import { Suspense } from "react";
import { LoginForm } from "./login-form";

function googleOAuthIsConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(id && secret);
}

export default function LoginPage() {
  const googleConfigured = googleOAuthIsConfigured();

  return (
    <Suspense fallback={null}>
      <LoginForm googleConfigured={googleConfigured} />
    </Suspense>
  );
}
