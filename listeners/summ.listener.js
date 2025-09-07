import registry from "../utils/serviceregistry.utils.js";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

registry.waitFor("summarizationns", { timeoutMs: 1000 }).then((io) => {
  io.use(useSocketAuth);
  io.on("connection", async (socket) => {
    let openai = await getOpenAIInstance();

    socket.on("disconnect", () => {
      logger.info(`[SUMMARIZATION] client left: ${socket.id}`);
    });
  });
});

async function getOpenAIInstance() {
  const openai = await registry.waitFor("openai");
  return openai;
}
