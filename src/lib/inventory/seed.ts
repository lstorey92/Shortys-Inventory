export type CountableItem = {
  id: string;
  name: string;
  unit: string;
  parLevel: number;
};

export type LocationSeed = {
  id: string;
  name: string;
  items: CountableItem[];
};

export const locationSeeds: LocationSeed[] = [
  {
    id: "downtown",
    name: "Downtown",
    items: [
      { id: "mozzarella", name: "Mozzarella Shredded", unit: "lb", parLevel: 40 },
      { id: "pepperoni", name: "Pepperoni Cups", unit: "bag", parLevel: 24 },
      { id: "doughball", name: "Dough Balls 16oz", unit: "each", parLevel: 120 },
      { id: "pizza_sauce", name: "Pizza Sauce", unit: "qt", parLevel: 18 },
      { id: "olive_oil", name: "Olive Oil", unit: "qt", parLevel: 12 },
    ],
  },
  {
    id: "eastside",
    name: "Eastside",
    items: [
      { id: "mozzarella", name: "Mozzarella Shredded", unit: "lb", parLevel: 36 },
      { id: "pepperoni", name: "Pepperoni Cups", unit: "bag", parLevel: 20 },
      { id: "doughball", name: "Dough Balls 16oz", unit: "each", parLevel: 95 },
      { id: "pizza_sauce", name: "Pizza Sauce", unit: "qt", parLevel: 16 },
      { id: "olive_oil", name: "Olive Oil", unit: "qt", parLevel: 10 },
    ],
  },
];
