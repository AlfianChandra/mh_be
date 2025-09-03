import emitter from "../utils/eventBus.js";
import registry from "../utils/serviceregistry.utils.js";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

let registeredEvents = [];
registry
  .waitFor("systemns", { timeoutMs: 1000 })
  .then((io) => {
    io.use(useSocketAuth);
    io.on("connection", async (socket) => {
      logger.info(`[SYSTEM] client connected: ${socket.id}`);
      let openai = await getOpenAIInstance();

      unregListener();
      registerListeners(io);

      socket.on("disconnect", () => {
        logger.info(`[SYSTEM] client left: ${socket.id}`);
        registry.unregister("systemns_socket");
        unregListener();
      });
    });
  })
  .catch((err) => {
    logger.error(`[SYSTEM] Error initializing system namespace: ${err}`);
  });

async function getOpenAIInstance() {
  const openai = await registry.waitFor("openai");
  return openai;
}

const registerListeners = async (io) => {
  if (registeredEvents.length > 0) {
    logger.warn("[SYSTEM] Listeners already registered, skipping...");
    return;
  }

  const listeners = [
    "system:tryout:created",
    "system:tryout:updated",
    "system:tryout:deleted",
  ];

  for (const event of listeners) {
    emitter.on(event, (data) => {
      logger.info(`[SYSTEM] Event received: ${event}`);
      //Broadcast to all client
    });
    registeredEvents.push(event);
  }
};

const unregListener = async () => {
  for (const event of registeredEvents) {
    emitter.off(event);
  }
  registeredEvents = [];
};
