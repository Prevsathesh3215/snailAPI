import * as net from "net";
import fs from "fs/promises";
import { Buffer } from "buffer";

class SnailAPI {
  constructor() {
    this.routes = {};
    this.server = net.createServer(this._handleConnection.bind(this));
  }

  listen(port, host, callback) {
    this.server.listen(port, host, callback);
  }

  get(path, handler) {
    this.routes[path] = handler;
  }

  _reqBuilder(data) {
    const methodSearchValue = /^(GET|POST|PUT)/;
    const pathSearchValue = /\/[A-Za-z0-9._~\-\/]*/;
    const decodedStr = data.toString("utf-8");

    //HTTP METHOD FINDER
    const httpMethod = searchSpecifics(methodSearchValue, decodedStr);

    // PATH FINDER
    const pathValue = searchSpecifics(pathSearchValue, decodedStr);

    // HEADER FINDER
    const [, ...headerLines] = decodedStr.split("\r\n");

    const headerText = headerLines.join("\r\n");
    const headers = this._parseHeaders(headerText);

    const [rawHeaders, body] = decodedStr.split("\r\n\r\n");

    return {
      header: headers,
      method: httpMethod[0],
      path: pathValue[0],
      body: body,
    };
  }

  _parseHeaders(raw) {
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
        send: (text, contentType = "text/plain") => {
          const buffer = Buffer.from(text);
          const header =
            "HTTP/1.1 200 OK\r\n" +
            `Content-Type: ${contentType}\r\n` +
            `Content-Length: ${buffer.length}\r\n\r\n`;

          socket.write(header + text);
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

      await handler(req, res);
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
