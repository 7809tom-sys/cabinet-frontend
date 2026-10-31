# Proposal: uniform finish nomenclature (`finish_aliases`) — NOT BUILT, for Tom's review

DLC_FR26 is the first example. Nothing below is implemented; no table, migration or SQL exists for it.

## Proposed table `finish_aliases`

| column | meaning |
|---|---|
| id | surrogate key |
| supplier | the catalog/source line, e.g. `20-20 DLC_FR26` |
| supplier_name | the name exactly as the source writes it (kept verbatim, never "fixed") |
| supplier_code | the source's own code if it has one (CG, DG, EWO...) |
| canonical_finish | our one spelling of the finish, e.g. `Cyber Grey` |
| distributor | who sells it to us, e.g. `DL Cabinetry` |
| style | door style it belongs to, e.g. 600011, or NULL if the finish is style-independent |
| status | `confirmed` / `needs-review` |
| note | the quirk, e.g. misspelling |

Unique on (supplier, supplier_name, distributor, style). Other lines plug in by adding rows with a new `supplier`; nothing in the lookup is DLC-specific. The Designer resolves a finish by `canonical_finish`, so a misspelling in a source never reaches a shopper.

## First example: DLC_FR26 finishes (supplier = `20-20 DLC_FR26`)

| supplier_name (file) | code | canonical_finish | status | note |
|---|---|---|---|---|
| Arctic White | | Arctic White | confirmed | |
| Chestnut | | Chestnut | confirmed | |
| Cyber Grey | CG | Cyber Grey | needs-review | "Grey" vs "Gray" spelling choice |
| Dark Caramel | DC | Dark Caramel | confirmed | |
| Dove Gray | DG | Dove Gray | needs-review | paf.xml says "Dove Grey", file says "Gray" |
| Driftwood | | Driftwood | confirmed | photo has no drawer |
| EWO | EWO | European White Oak | confirmed | grain textures available |
| Expresso Shaker | SSE | Espresso Shaker | needs-review | source misspelling |
| Glacier White | GW | Glacier White | confirmed | |
| Grey Shaker | | Grey Shaker | needs-review | "Grey" spelling |
| Ivory White | | Ivory White | confirmed | |
| MC | MC | Midnight Cove | **needs Tom** | paf.xml says Midnight Cove; please confirm |
| New York Glaze | | New York Glaze | confirmed | |
| Pearl White | PW | Pearl White | confirmed | |
| Peccan | | Pecan | needs-review | source misspelling |
| Port | | Port | confirmed | |
| Slim Shaker Alabaster | SSA | Slim Shaker Alabaster | confirmed | |
| Slim Shaker Ebony | | Slim Shaker Ebony | confirmed | |
| Versa Shaker | VS | Versa Shaker | confirmed | |
| White Shaker | WS | White Shaker | confirmed | |
| IMG | | (none) | excluded | "image not available" placeholder |

## DL mapping (distributor = DL Cabinetry)

The DL style for each finish is not in the catalog; the DL door-style list lives in the database. I have not guessed it. Please send the DL style/finish list (or tell me which DL style each finish belongs to) and I will fill the `style` column. Until then the table above is the DLC-side half only (see `data/dlc-fr26/reports/finish_name_map.csv`).

## Questions
1. Spelling: Grey or Gray as our canonical form?
2. MC = Midnight Cove?
3. OK to store source names verbatim and correct only `canonical_finish`?
