import * as net from "net";
import fs from "fs/promises";
import { Buffer } from "buffer";
import jwt from "jsonwebtoken";

class SnailAPI {
  constructor() {
    this.routes = {};
    this.server = net.createServer(this._handleConnection.bind(this));
    this.middlewares = [];
  }

  useJWT(config) {
    this.jwtConfig = {
      secret: config.secret,
      expiresIn: config.expiresIn || "1h",
      issuer: config.issuer || "snailapi",
    };

    return this;
  }

  sign(payload) {
    const token = jwt.sign(payload, this.jwtConfig.secret, {
      expiresIn: this.jwtConfig.expiresIn,
      issuer: this.jwtConfig.issuer,
    });

    return token;
  }

  protect(cookieName = "token") {
    return (req, res, next) => {
      try {
        if (!this.jwtConfig) throw new Error("JWT not configured");

        console.log(req);
        const token = req.cookies[cookieName];

        if (!token) {
          res.statusCode = 401;
          return res.json({ error: "Unauthorized: no token" });
        }

        const decoded = jwt.verify(token, this.jwtConfig.secret, {
          issuer: this.jwtConfig.issuer,
        });

        req.user = decoded;
        next();
      } catch (err) {
        res.statusCode = 401;
        res.json({ error: "Unauthorized", detail: err.message });
      }
    };
  }

  listen(port, host, callback) {
    this.server.listen(port, host, callback);
  }

  get(path, ...handlers) {
    this.routes[path] = handlers;
  }

  post(path, ...handlers) {
    this.routes[path] = handlers;
  }

  use(fn) {
    this.middlewares.push(fn);
  }

  runMiddlewares(req, res, middlewares, done) {
    let index = 0;

    const next = (err) => {
      if (err) {
        res.statusCode = 500;
        return res.end("Middleware error: " + err);
      }

      const mw = middlewares[index++];
      if (!mw) return done();

      mw(req, res, next);
    };

    next();
  }

  _reqBuilder(data) {
    const methodSearchValue = /^(GET|POST|PUT)/;
    const pathSearchValue = /\/[A-Za-z0-9._~\-\/]*/;
    const decodedStr = data.toString("utf-8");

    const httpMethod = searchSpecifics(methodSearchValue, decodedStr);
    const pathValue = searchSpecifics(pathSearchValue, decodedStr);

    const [, ...headerLines] = decodedStr.split("\r\n");
    const headerText = headerLines.join("\r\n");
    const headers = this._parseHeaders(headerText);
    // console.log(headers);

    // Extract cookies
    const cookieHeader = headers.cookie || "";
    const cookies = {};
    cookieHeader.split(";").forEach((c) => {
      const [k, ...v] = c.trim().split("=");
      if (k && v.length) cookies[k] = v.join("=");
    });

    const [rawHeaders, body] = decodedStr.split("\r\n\r\n");

    return {
      headers,
      cookies,
      method: httpMethod[0],
      path: pathValue[0],
      body,
    };
  }

  _parseHeaders(raw) {
    console.log(raw);
    const lines = raw.split("\r\n");
    const headers = {};

    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();

      headers[key] = value;
    }

    return headers;
  }

  _handleConnection(socket) {
    socket.on("data", async (data) => {
      const req = this._reqBuilder(data);
      const handler = this.routes[req.path];

      if (!handler) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }

      const res = {
        _headers: {},
        send(text, contentType = "text/plain") {
          const buffer = Buffer.from(text);

          let header = "HTTP/1.1 200 OK\r\n";
          header += `Content-Type: ${contentType}\r\n`;
          header += `Content-Length: ${buffer.length}\r\n`;

          if (this._headers["Set-Cookie"]) {
            for (const c of this._headers["Set-Cookie"]) {
              header += `Set-Cookie: ${c}\r\n`;
            }
          }

          header += "\r\n";
          socket.write(header + text);
        },

        cookie: (name, value, options = {}) => {
          let cookieStr = `${name}=${value}`;
          if (options.httpOnly) cookieStr += "; HttpOnly";
          if (options.path) cookieStr += `; Path=${options.path || "/"}`;
          if (options.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
          if (options.secure) cookieStr += "; Secure";
          if (options.sameSite)
            cookieStr += `; SameSite=${options.sameSite || "Strict"}`;

          if (!res._headers["Set-Cookie"]) res._headers["Set-Cookie"] = [];
          res._headers["Set-Cookie"].push(cookieStr);
        },

        json: (obj) => {
          const json = JSON.stringify(obj);
          res.send(json);
        },

        sendFile: async (
          filePath,
          contentType = "application/octet-stream"
        ) => {
          const fileData = await fs.readFile(filePath);
          const header =
            "HTTP/1.1 200 OK\r\n" +
            `Content-Type: ${contentType}\r\n` +
            `Content-Length: ${fileData.length}\r\n\r\n`;

          socket.write(header);
          socket.write(fileData);
        },
      };

      this.runMiddlewares(req, res, this.middlewares, () => {
        const handlers = this.routes[req.path];
        let index = 0;

        const next = () => {
          const h = handlers[index++];
          if (!h) return;

          if (h.length === 3) {
            h(req, res, next);
          } else {
            h(req, res);
          }
        };

        next();
      });
    });

    socket.on("close", () => socket.end());
  }
}


async function readText(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  return { data, length: Buffer.byteLength(data), contentType: "text/plain" };
}

async function readBinary(filePath) {
  const data = await fs.readFile(filePath);
  return { data, length: data.length, contentType: "application/octet-stream" };
}

function searchSpecifics(searchValue, decodedStr) {
  const foundItem = decodedStr.match(searchValue);

  return foundItem;
}

export { SnailAPI, readText, readBinary };
