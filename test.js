import { SnailAPI, readBinary, readText } from "./snailApi.js";

const app = new SnailAPI();

app.get("/about", async (req, res) => {
  await res.send("Hello from SnailAPI!");
});

app.get("/text", async (req, res) => {
  await res.sendFile("./public/myfile.txt", "text/plain");
});

app.get("/json", async (req, res) => {
  await res.json({ name: "Sathesh", age: 26 });
});

app.use((req, res, next) => {
  console.log("Middleware ran:", req.method, req.path);
  next();
});

app.listen(4221, "localhost", () => {
  console.log("SnailAPI running on port 4221");
});
