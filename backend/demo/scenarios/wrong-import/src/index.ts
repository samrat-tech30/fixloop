import { renderHeader } from "./componets/header";
import { retries } from "./config";
import { formatPrice } from "./utils";

console.log(renderHeader("Acme Store"));
console.log(`Retries: ${retries}`);
console.log(formatPrice(499));
