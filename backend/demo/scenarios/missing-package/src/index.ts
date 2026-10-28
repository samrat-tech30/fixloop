import axios from "axios";
import { renderHeader } from "./components/header";
import { retries } from "./config";
import { formatPrice } from "./utils";

axios.defaults.timeout = 5000;

console.log(renderHeader("Acme Store"));
console.log(`Retries: ${retries}`);
console.log(formatPrice(499));
