import { flooringCartonFacts, formatCartonFact, type FlooringCartonSource } from "@/lib/flooringCartonFacts";

/**
 * Pieces per box and square feet per box.
 * Visible at every width, including a 768–1024 tablet. Missing facts are a dash.
 */
export function FlooringCartonFacts({
  product,
  testId = "flooring-carton-facts",
  className = "",
}: {
  product: FlooringCartonSource;
  testId?: string;
  className?: string;
}) {
  const facts = flooringCartonFacts(product);
  if (!facts) return null;
  return (
    <p data-testid={testId} className={`space-y-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs ${className}`}>
      <span className="block">Pieces per box: {formatCartonFact(facts.piecesPerBox)}</span>
      <span className="block">Sq ft per box: {formatCartonFact(facts.sqFtPerBox)}</span>
    </p>
  );
}
