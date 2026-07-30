class Inventory {
  #items;
  #defaultSelected;
  #maxSlots;
  #isOpen;

  constructor(config) {
    this.#items = new Map();
    this.#defaultSelected = null;
    this.#maxSlots = config?.['max-slots'] ?? 8;
    this.#isOpen = false;
  }

  get items() { return new Map(this.#items); }
  get defaultSelected() { return this.#defaultSelected; }
  set defaultSelected(itemName) {
    if (itemName === null || this.#items.has(itemName)) {
      this.#defaultSelected = itemName;
    }
  }

  get maxSlots() { return this.#maxSlots; }

  get isOpen() { return this.#isOpen; }
  set isOpen(v) { this.#isOpen = v; }

  add(itemName, quantity) {
    const qty = quantity ?? 1;
    const current = this.#items.get(itemName) ?? 0;
    this.#items.set(itemName, current + qty);
  }

  remove(itemName, quantity) {
    const qty = quantity ?? 1;
    const current = this.#items.get(itemName) ?? 0;
    const newQty = Math.max(0, current - qty);
    if (newQty <= 0) {
      this.#items.delete(itemName);
      if (this.#defaultSelected === itemName) {
        this.#defaultSelected = null;
      }
    } else {
      this.#items.set(itemName, newQty);
    }
  }

  has(itemName) {
    return (this.#items.get(itemName) ?? 0) > 0;
  }

  count(itemName) {
    return this.#items.get(itemName) ?? 0;
  }

  use(itemName) {
    const count = this.#items.get(itemName) ?? 0;
    if (count <= 0) {
      return false;
    }
    this.remove(itemName, 1);
    return true;
  }

  get slots() {
    const result = [];
    for (const [name, count] of this.#items) {
      result.push({ name, count });
    }
    return result;
  }
}

export { Inventory };
