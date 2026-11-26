/**
 * Field names that may never appear in a public schema. The second line behind the surface snapshot: the snapshot
 * catches every new readable key, this list names the ones that must never be approved. Keys are compared without
 * case, `_` or `-` (`price_paid` and `pricePaid` are the same entry), so each name is listed once.
 *
 * Source: `docs/brief/unified-brief.md`, "Data model", which says of the record layers: "Some types can never be
 * published whatever their flag: purchases, prices paid, order references, addresses, medicine, and other people's
 * names. The schema enforces that by type." Each group below quotes the phrase it covers. Adding a name is safe;
 * removing one is a never-auto-merge change.
 */
export const NEVER_PUBLIC: readonly string[] = [
  // "purchases" (and the Private layer's Purchase record: "OwnedUnit, Purchase, ...")
  "purchase",
  "purchases",
  "purchaseDate",
  "purchasedAt",
  "purchasedFrom",
  "purchasePrice",
  // "prices paid"
  "pricePaid",
  "pricesPaid",
  "paidPrice",
  "amountPaid",
  // "order references"
  "orderNumber",
  "orderReference",
  "orderRef",
  "orderId",
  "receiptNumber",
  // "addresses"
  "address",
  "addresses",
  "shippingAddress",
  "billingAddress",
  "deliveryAddress",
  "homeAddress",
  "postalAddress",
  "streetAddress",
  // "medicine" (a loadout role can be a "Medicine pouch"; its contents are the never-public part)
  "medicine",
  "medicines",
  "medication",
  "medications",
  // "other people's names"
  "personName",
  "partnerName",
  "friendName",
  "companionName",
  "companionNames",
  "contactName",
  "recipientName",
];
