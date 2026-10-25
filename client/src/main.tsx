import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CartProvider } from "@/contexts/CartContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { shouldRedirectToLoginOnError } from "./lib/authRedirect";
import { fetchTrpcJson, TRPC_QUERY_METHOD_OVERRIDE } from "./lib/trpcTransport";
import { supabase } from "./lib/supabase";
import { apiUrl } from "./lib/apiBase";
import "./index.css";

const queryClient = new QueryClient();

const goToLogin = () => {
  if (typeof window === "undefined") return;
  // getLoginUrl() without an explicit connected provider resolves to the
  // CabinetDealz-owned /signin page, never the external OAuth broker.
  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    // Background QUERY errors NEVER force a redirect (see authRedirect.ts): a
    // guest browsing public pages can trigger a protected query that 401s, and
    // redirecting mid-browse corrupts history so the browser Back button breaks.
    if (shouldRedirectToLoginOnError(error, "query")) goToLogin();
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    // Only a deliberate ACTION (mutation) that fails with "unauthorized" sends
    // the user to log in — an expired session on submit/save/checkout.
    if (shouldRedirectToLoginOnError(error, "mutation")) goToLogin();
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: apiUrl("/api/trpc"),
      transformer: superjson,
      methodOverride: TRPC_QUERY_METHOD_OVERRIDE,
      async fetch(input, init) {
        // getSession() returns the cached session and refreshes an expired
        // access token, so every request carries a currently valid token.
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return fetchTrpcJson(input, init);
        const headers = new Headers(init?.headers);
        headers.set("authorization", `Bearer ${token}`);
        return fetchTrpcJson(input, { ...init, headers });
      },
    }),
  ],
});

// Sign-in, sign-out and token refreshes change who the server sees.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
    void queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
  }
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
