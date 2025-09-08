import dotenv from "dotenv";
dotenv.config({ silent: true });
import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import OpenAI from "openai";
import emitter from "./utils/eventBus.js";
import logger from "./utils/logger.utils.js";
import registry from "./utils/serviceregistry.utils.js";
import loadListeners from "./listeners/index.js";
import Mode from "./models/mode.model.js";

global.logger = logger;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const serverPort = process.env.SERVER_PORT || 9703;
const serverEnv = process.env.SERVER_ENV === "development";
const serverAppVersion = process.env.APP_VERSION || "1.0.1";
const serverAppUrl = process.env.APP_URL || "http://localhost";

//The bootstrap function initializes the server and socket.io
async function bootstrap() {
  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    pingTimeout:60000,
    cors: {
      origin: ["https://meethint.rndkito.com", "http://localhost:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const mode = await Mode.find({});
  const OPENAI_API_KEY =
    mode.length > 0
      ? mode[0].mode === "dev"
        ? process.env.OPENAI_API_KEY_MODE_DEV
        : process.env.OPENAI_API_KEY_MODE_PROD
      : process.env.OPENAI_API_KEY_MODE_DEV;
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  registry.register("http.server", server);
  registry.register("socket.io", io);
  registry.register("openai", openai);
  //Register namespaces individually
  registry.register("chatns", io.of("/chat"));
  registry.register("systemns", io.of("/system"));
  registry.register("hintns", io.of("/hint"));
  registry.register("transcriptionns", io.of("/transcription"));
  registry.register("summarizationns", io.of("/summarization"));

  logger.info("[BOOTSTRAP] Loading listeners...");
  await loadListeners();

  logger.info("[BOOTSTRAP] All services ready.");
  return { server, io };
}

function setupGracefulShutdown({ server, io }) {
  const shutdown = async (signal) => {
    try {
      logger.warn(`[SHUTDOWN] Received ${signal}, closing services...`);
      if (io && io.close) {
        await new Promise((res) => io.close(res));
        logger.info("[SHUTDOWN] socket.io closed.");
      }
      if (server && server.close) {
        await new Promise((res) => server.close(res));
        logger.info("[SHUTDOWN] HTTP server closed.");
      }

      emitter.emit("server:stopped");
      process.exit(0);
    } catch (err) {
      logger.error(`[SHUTDOWN] Error: ${err.message}`);
      process.exit(1);
    }
  };

  ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

const { server, io } = await (async () => {
  const { server, io } = await bootstrap();
  server.listen(serverPort, () => {
    console.log("=======================");
    console.log("KICKSTARTING THE SERVER");
    console.log("=======================");
    logger.info(
      `[SERVER] [v${serverAppVersion}] [${
        serverEnv ? "DEVELOPMENT" : "PRODUCTION"
      }]: Server is running on ${serverAppUrl}:${serverPort}/`
    );
  });

  setupGracefulShutdown({ server, io });
  return { server, io };
})();
