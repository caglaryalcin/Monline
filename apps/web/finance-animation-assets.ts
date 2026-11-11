import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

const animationFile = /^savings-(?:banknote|credit-card|dollar|euro|gold|loans|price-tag|raise|receipt|wallet)(?:-(?:72|144|216))?\.(?:gif|webp)$/;

/** Change only the loop count, preserving every frame and its timing. */
function infiniteAnimation(filename: string): Buffer {
  const bytes = fs.readFileSync(filename);
  if (filename.endsWith(".webp")) {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const size = bytes.readUInt32LE(offset + 4);
      if (bytes.toString("ascii", offset, offset + 4) === "ANIM" && size >= 6) {
        bytes.writeUInt16LE(0, offset + 12);
        return bytes;
      }
      offset += 8 + size + (size % 2);
    }
  } else {
    const loopHeader = Buffer.concat([
      Buffer.from([0x21, 0xff, 0x0b]),
      Buffer.from("NETSCAPE2.0", "ascii"),
      Buffer.from([0x03, 0x01]),
    ]);
    const offset = bytes.indexOf(loopHeader);
    if (offset !== -1 && offset + loopHeader.length + 2 <= bytes.length) {
      bytes.writeUInt16LE(0, offset + loopHeader.length);
      return bytes;
    }
  }
  throw new Error("Animation has no loop metadata: " + path.basename(filename));
}

/** Serve looping variants locally and emit the same files in production builds. */
export function financeAnimationAssets(): Plugin {
  let directory = "";
  return {
    name: "monline-finance-animations",
    configResolved(config) {
      directory = path.join(config.publicDir, "assets");
    },
    configureServer(server) {
      server.middlewares.use("/assets/", (request, response, next) => {
        const requested = (request.url ?? "").split("?")[0].replace(/^\//, "");
        if (!/-loop\.(gif|webp)$/.test(requested)) return next();
        const original = requested.replace(/-loop(\.(?:gif|webp))$/, "$1");
        if (!animationFile.test(original)) return next();
        const filename = path.join(directory, original);
        if (!fs.existsSync(filename)) return next();
        try {
          response.setHeader("Content-Type", filename.endsWith(".webp") ? "image/webp" : "image/gif");
          response.setHeader("Cache-Control", "public, max-age=3600");
          response.end(infiniteAnimation(filename));
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle() {
      for (const filename of fs.readdirSync(directory).filter((name) => animationFile.test(name))) {
        this.emitFile({
          type: "asset",
          fileName: "assets/" + filename.replace(/\.(gif|webp)$/, "-loop.$1"),
          source: infiniteAnimation(path.join(directory, filename)),
        });
      }
    },
  };
}
