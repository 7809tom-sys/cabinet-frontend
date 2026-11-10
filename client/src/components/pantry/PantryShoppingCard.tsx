import type { PantryShoppingList } from "@shared/pantryShoppingList";

/**
 * Standalone preload card for a pantry master. The 3D Designer does not
 * import this. A later designer change can render it when the selected
 * cabinet's master code is one of the pantry order codes.
 */
export function PantryShoppingCard({ list }: { list: PantryShoppingList }) {
  return (
    <section aria-label={`Pantry ${list.masterCode} shopping list`}>
      <img src={list.diagramPath} alt={list.description} />
      <p>{list.description}</p>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {list.lines.map((line) => (
            <tr key={line.code}>
              <td>{line.code}</td>
              <td>{line.description}</td>
              <td>{line.qty}</td>
              <td>{line.priceLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{list.total == null ? "price pending" : `Total $${list.total.toFixed(2)}`}</p>
    </section>
  );
}
