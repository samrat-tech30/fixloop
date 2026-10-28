import { renderHeader } from "./components/header";
import { retries } from "./config";
import { orderDate, orderTotal } from "./orders";
import { formatPrice } from "./utils";

const cart = [
  { name: "Keyboard", price: 1499, qty: 1 },
  { name: "Mouse", price: 499, qty: 2 },
];

console.log(renderHeader("Acme Store"));
console.log(`Retries: ${retries}`);
console.log(`Order placed on ${orderDate()}`);
console.log(`Total: ${formatPrice(orderTotal(cart))}`);
