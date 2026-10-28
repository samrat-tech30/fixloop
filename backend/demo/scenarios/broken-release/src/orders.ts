import dayjs from "dayjs";

export interface Item {
  name: string;
  price: number;
  qty: number;
}

export function orderTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderDate(): string {
  return dayjs().format("DD MMM YYYY");
}
