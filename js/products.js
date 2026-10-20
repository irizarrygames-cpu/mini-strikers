// Coin packs: the only thing the game sells.
//
// This one file is read by the game (to draw the shop) AND by the server (to decide how many coins
// a verified purchase is worth). The server never trusts a number from the game: it takes the
// product id out of the store's own record of the purchase and looks the coins up here, so a player
// cannot change what a pack is worth by editing their copy of the page.
//
// An `id` is also the product id typed into App Store Connect and Google Play Console, so it must
// match there exactly and must never be reused for a different pack. Change `coins` or `price` freely
// (the price shown is the store's own when it is known; `price` is only the fallback), but add a new
// id rather than re-using one if a pack's meaning changes.
//
// The bigger the pack the better the rate, topping out at 40% extra. Nothing here is a random roll:
// you pay a fixed price for a fixed number of coins. Crates are still bought with coins, and their
// odds are shown on the crate shelf.
const PRODUCTS = [
  { id: 'coins_pack_1', name: 'POCKET MONEY', coins: 5000, price: '$0.99', bonus: 0 },
  { id: 'coins_pack_2', name: 'COIN BAG', coins: 11000, price: '$1.99', bonus: 10 },
  { id: 'coins_pack_3', name: 'COIN SACK', coins: 30000, price: '$4.99', bonus: 20 },
  { id: 'coins_pack_4', name: 'COIN CHEST', coins: 65000, price: '$9.99', bonus: 30 },
  { id: 'coins_pack_5', name: 'COIN VAULT', coins: 140000, price: '$19.99', bonus: 40 },
];

// How many packs one account can buy in a day through the game's own shop. A guard against a late
// night of tapping, not a security measure: the stores' own family controls are the real limit.
const IAP_DAILY_PACKS = 4;

if (typeof module !== 'undefined' && module.exports) module.exports = { PRODUCTS, IAP_DAILY_PACKS };
