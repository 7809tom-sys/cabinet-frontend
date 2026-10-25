import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Deployment notices must stay visible above every Dialog, Sheet,
          // and Designer attribute panel. They remain non-blocking and reload
          // only after the user selects the explicit action.
          zIndex: 2147483647,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
