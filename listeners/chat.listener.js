import registry from "../utils/serviceregistry.utils.js";

registry.waitFor("chatns", { timeoutMs: 1000 }).then((io) => {
  io.on("connection", async (socket) => {
    let openai = await getOpenAIInstance();

    socket.on("disconnect", () => {
      logger.info(`[CHAT] client left: ${socket.id}`);
    });
  });
});

async function getOpenAIInstance() {
  const openai = await registry.waitFor("openai");
  return openai;
}
