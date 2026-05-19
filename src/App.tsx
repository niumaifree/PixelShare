import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk, ClerkLoaded, ClerkLoading } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home, { CommunityPage } from "@/pages/Home";
import CollectionPage from "@/pages/Collection";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "#ff4757",
    colorForeground: "#1a1a1a",
    colorMutedForeground: "#666666",
    colorDanger: "#ff4757",
    colorBackground: "#ffffff",
    colorInput: "#f1f1f1",
    colorInputForeground: "#1a1a1a",
    colorNeutral: "#e0e0e0",
    fontFamily: "Inter, -apple-system, sans-serif",
    borderRadius: "12px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#1a1a1a] font-bold",
    headerSubtitle: "text-[#666666]",
    socialButtonsBlockButtonText: "text-[#1a1a1a] font-medium",
    formFieldLabel: "text-[#1a1a1a] font-medium",
    footerActionLink: "text-[#ff4757] font-medium",
    footerActionText: "text-[#666666]",
    dividerText: "text-[#666666]",
    identityPreviewEditButton: "text-[#ff4757]",
    formFieldSuccessText: "text-green-600",
    alertText: "text-[#1a1a1a]",
    socialButtonsBlockButton: "border border-[#e0e0e0] bg-white hover:bg-gray-50",
    formButtonPrimary: "bg-[#ff4757] hover:bg-[#e63946] text-white font-semibold",
    formFieldInput: "bg-[#f1f1f1] border border-[#e0e0e0] text-[#1a1a1a] rounded-xl",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#e0e0e0]",
    alert: "bg-red-50 border border-red-200",
    otpCodeFieldInput: "bg-[#f1f1f1] border-[#e0e0e0]",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function AuthLoader() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-full border-[3px] border-[#e0e0e0] border-t-[#ff4757] animate-spin" />
      <p className="text-sm text-gray-400">Loading…</p>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4">
      <ClerkLoading>
        <AuthLoader />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </ClerkLoaded>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4">
      <ClerkLoading>
        <AuthLoader />
      </ClerkLoading>
      <ClerkLoaded>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </ClerkLoaded>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back to PixelShare", subtitle: "Sign in to save and share images" } },
        signUp: { start: { title: "Join PixelShare", subtitle: "Discover, save, and share stunning imagery" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/community" component={CommunityPage} />
            <Route path="/collection" component={CollectionPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
