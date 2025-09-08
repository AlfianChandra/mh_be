import registry from "../utils/serviceregistry.utils.js";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

registry.waitFor("summarizationns", { timeoutMs: 1000 }).then((io) => {
  io.use(useSocketAuth);
  io.on("connection", async (socket) => {
    let openai = await getOpenAIInstance();
    console.log("[SUMMARIZATION] client connected: " + socket.id);
    socket.on("summarization:request", async (data) => {
      try {
        let input = [
          {
            role: "system",
            content: `Kasih contekan tentang topik yang diberikan user. Buat dalam bentuk poin-poin. Sekalian berikan contohnya`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Ini topiknya: " + data.input_text },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Ini fokus konteksnya: " + data.input_context,
              },
            ],
          },
        ];
        if (data.input_image !== null) {
          input.push({
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Ini gambar dari user",
              },
              {
                type: "input_image",
                image_url: data.input_image,
              },
            ],
          });
        }

        console.log(input);
        const response = await openai.responses.create({
          model: data.setting.model,
          input: input,
          stream: true,
        });

        for await (const res of response) {
          if (res.delta !== undefined) {
            socket.emit("summarization:response-delta", res.delta);
          }

          if (res.type === "response.completed") {
            socket.emit("summarization:response-complete");
          }
        }
      } catch (err) {
        console.log(err);
      }
    });
    socket.on("disconnect", () => {
      logger.info(`[SUMMARIZATION] client left: ${socket.id}`);
    });
  });
});

async function getOpenAIInstance() {
  const openai = await registry.waitFor("openai");
  return openai;
}
