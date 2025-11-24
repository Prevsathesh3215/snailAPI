import * as net from "net";
import fs from "fs/promises";
import { Buffer } from "buffer";

function searchSpecifics(searchValue, decodedStr) {
  const foundItem = decodedStr.match(searchValue);

  return foundItem;
}

function parseHeaders(raw) {
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

function reqBuilder(data) {
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
  const headers = parseHeaders(headerText);

  const [rawHeaders, body] = decodedStr.split("\r\n\r\n");

  return {
    header: headers,
    method: httpMethod[0],
    path: pathValue[0],
    body: body,
  };
}

async function readText(filePath) {
  const data = await fs.readFile(filePath, "utf8");
  return {
    data,
    length: Buffer.byteLength(data),
  };
}

async function readBinary(filePath) {
  const data = await fs.readFile(filePath);
  return {
    data,
    length: data.length,
  };
}

const server = net.createServer((socket) => {
  // console.log("Socket running");

  socket.on("data", async (data) => {
    const request = reqBuilder(data);
    // console.log(request);

    const paths = {
      "/about": async () => ({
        contentType: "text/html",
        ...(await readText("./public/test.html")),
      }),

      "/text": async () => ({
        contentType: "text/plain",
        ...(await readText("./public/myfile.txt")),
      }),

      "/image": async () => ({
        contentType: "image/png",
        ...(await readBinary("./public/view.jpg")),
      }),
    };

    const handler = paths[request.path];

    if (!handler) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }

    const content = await handler();
    console.log("Content:", content);

    // console.log(
    //   "HTTP/1.1 200 OK\r\n" +
    //     `Content-Type: ${content.contentType}\r\n` +
    //     `Content-Length: ${content.length}\r\n` +
    //     "\r\n" +
    //     `${content.data}`
    // );

    const responseBody =
      "HTTP/1.1 200 OK\r\n" +
      `Content-Type: ${content.contentType}\r\n` +
      `Content-Length: ${content.length}\r\n` +
      "\r\n";

    if (request.path !== "/image") {
      socket.write(responseBody + content.data);
    } else {
      socket.write(responseBody);
      socket.write(content.data);
    }
  });

  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost", () => {
  console.log("TCP Server running on port 4221");
});
