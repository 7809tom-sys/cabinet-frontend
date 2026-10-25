import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openLiveChat, isTawkConfigured } from "@/lib/tawk";
import { MessageCircle, X, Headset } from "lucide-react";
import { toast } from "sonner";
import { isAffiliateStorefrontPath } from "@/lib/affiliateContext";

const WELCOME =
  "Hi! I'm the Cabinet Dealz assistant. Ask me about cabinet styles, sizes, ordering, or your kitchen project. Want a human? Tap \u201cTalk to a live person\u201d below.";

const SUGGESTED = [
  "What door styles do you offer?",
  "How do I order cabinets?",
  "Help me design my kitchen",
];

// Shared state lifted out so both ChatTrigger (in TopNav) and ChatPanel (global)
// can share the same open/messages state via a simple module-level store.
let _setOpen: ((v: boolean | ((prev: boolean) => boolean)) => void) | null = null;
export function openChatWidget() { _setOpen?.((v) => !v); }

export function ChatWidget() {
  const [location] = useLocation();
  // White-label rule: the platform assistant is platform branding, so it must
  // never appear anywhere inside an affiliate's storefront experience.
  const isAffiliateStore = isAffiliateStorefrontPath(location);
  // The Kitchen/Closet Designer uses a fixed bottom toolbar (Delete/Cart) on
  // touch layouts (<1024px). The floating chat launcher would sit on top of it,
  // covering those controls, so we hide the launcher there. Desktop keeps chat.
  const isDesignerTouch = useIsMobile(1024) && location.startsWith("/design");

  const [open, setOpen] = useState(false);
  // Register setter so TopNav's inline trigger can toggle this panel.
  useEffect(() => { _setOpen = setOpen; return () => { _setOpen = null; }; }, [setOpen]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connecting, setConnecting] = useState(false);
  // The Designer's own "Design Consultant" panel is a second chat surface that
  // overlaps the bottom-right launcher. While it's open, hide this global
  // launcher/panel so the two never collide. The designer dispatches a
  // "cd:consultant" CustomEvent({ detail: { open } }) when it opens/closes.
  const [consultantOpen, setConsultantOpen] = useState(false);
  useEffect(() => {
    const onConsultant = (e: Event) => {
      setConsultantOpen(Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    window.addEventListener("cd:consultant", onConsultant as EventListener);
    return () => window.removeEventListener("cd:consultant", onConsultant as EventListener);
  }, []);

  const chat = trpc.assistant.chat.useMutation();

  // If we navigate into the designer on a touch layout while the panel is open,
  // close it so nothing lingers over the toolbar.
  useEffect(() => {
    if (isDesignerTouch && open) setOpen(false);
  }, [isDesignerTouch, open]);

  const handleSend = useCallback(
    (content: string) => {
      const next: Message[] = [...messages, { role: "user", content }];
      setMessages(next);
      chat.mutate(
        { messages: next.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) },
        {
          onSuccess: (res) => {
            setMessages((cur) => [...cur, { role: "assistant", content: res.reply }]);
          },
          onError: () => {
            setMessages((cur) => [
              ...cur,
              {
                role: "assistant",
                content:
                  "Sorry, I hit a snag. Please try again, or tap \u201cTalk to a live person\u201d.",
              },
            ]);
          },
        },
      );
    },
    [messages, chat],
  );

  const handleLiveChat = useCallback(async () => {
    setConnecting(true);
    const ok = await openLiveChat();
    setConnecting(false);
    if (ok) {
      setOpen(false);
      toast.success("Connecting you with our team…");
    } else if (!isTawkConfigured()) {
      toast.info("Live chat is being set up", {
        description: "In the meantime, ask here or request a quote and we'll reach out.",
      });
    } else {
      toast.error("Couldn't open live chat. Please try again in a moment.");
    }
  }, []);

  if (isAffiliateStore || isDesignerTouch || consultantOpen) return null;

  return (
    <>
      {/* Panel — the trigger is now in TopNav beside the logo */}
      {open && (
        <div
          className={cn(
            "fixed top-[4.25rem] left-0 z-50 w-[min(380px,calc(100vw-1rem))] sm:left-auto sm:right-5",
            "rounded-xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden",
            "flex flex-col",
          )}
          style={{ maxHeight: "min(620px, calc(100vh - 11rem))" }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-[var(--color-navy,#1a2740)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium">Cabinet Dealz Assistant</span>
            </div>
            <button aria-label="Close chat" onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <AIChatBox
              messages={messages}
              onSendMessage={handleSend}
              isLoading={chat.isPending}
              height="100%"
              placeholder="Ask about cabinets, styles, ordering…"
              emptyStateMessage={WELCOME}
              suggestedPrompts={SUGGESTED}
            />
          </div>

          <div className="border-t border-border p-2.5">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleLiveChat}
              disabled={connecting}
            >
              <Headset className="h-4 w-4" />
              {connecting ? "Connecting…" : "Talk to a live person"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Compact inline trigger button to place beside the logo in TopNav. */
export function ChatTrigger({ isOpen }: { isOpen?: boolean }) {
  return (
    <button
      aria-label={isOpen ? "Close chat" : "Open chat assistant"}
      onClick={() => openChatWidget()}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "border border-border/60 bg-muted/60 hover:bg-muted text-foreground/70 hover:text-foreground",
        "transition-colors duration-150 shrink-0",
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  );
}

export default ChatWidget;
