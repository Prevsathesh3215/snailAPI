import fs from "fs/promises";

class TinyDB {
  constructor(filePath = null) {
    this.store = {};
    this.filePath = filePath;
  }

  async load() {
    if (!this.filePath) return;
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.store = JSON.parse(data);
    } catch {
      this.store = {};
    }
  }

  async save() {
    if (!this.filePath) return;
    await fs.writeFile(this.filePath, JSON.stringify(this.store, null, 2));
  }

  async set(key, value) {
    this.store[key] = value;
    await this.save();
  }

  get(key) {
    return this.store[key];
  }

  async delete(key) {
    delete this.store[key];
    await this.save();
  }
}


export default TinyDB;