import { ZappAPI } from "./zappAPI.js";
import TinyDB from "./tinyDB.js";

const app = new ZappAPI();
app.db = new TinyDB("data.json");

app.useJWT({
  secret: "abc123",
  expiresIn: "2h",
});

app.post("/login", (req, res) => {
  const token = app.sign({ id: 99, name: "MyDude" });

  console.log(token);
  res.cookie("token", token, { httpOnly: true, path: "/", maxAge: 3600 });
  res.json({ message: "Logged in" });
});

app.get("/profile", app.protect(), (req, res) => {
  res.json({
    message: "Authenticated request!",
    user: req.user,
  });
});

app.post("/set", app.protect(),  (req, res) => {
  app.db.set("foo", req.body);
  res.json({ ok: true });
});

app.get("/get", (req, res) => {
  res.json({ value: app.db.get("foo") });
});

app.get("/about", async (req, res) => {
  await res.send("Hello from ZappAPI!");
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
  console.log("ZappAPI running on port 4221");
});
