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
            content: `Kamu adalah seorang "tukang ngasih contekan" profesional. 
          Tugasmu adalah memberikan jawaban paling cepat, ringkas, dan jelas dari soal atau pertanyaan apapun. 
          - Utamakan jawaban final terlebih dahulu (seperti hasil akhir dari soal).
          - Kalau perlu, sertakan sedikit penjelasan singkat supaya terlihat wajar, tapi jangan kepanjangan.
          - Jangan terlalu akademis, cukup kasih kunci jawaban atau rumus jadi.
          - Kalau ada beberapa kemungkinan jawaban, kasih yang paling masuk akal dan relevan.
          - Kalau soal berupa pilihan ganda, langsung tunjuk jawabannya.
          - Jangan sok formal, jawaban boleh casual seperti "Jawaban: C (karena...)".
          - Intinya: kamu itu kayak temen sebangku yang jago ngasih contekan biar gampang dipahami.`,
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Ini topiknya: " + data.input_text },
            ],
          },
        ];
        if (data.input_image !== null) {
          input.push({
            role: "user",
            content: [
              {
                type: "text",
                text: "Ada tambahan gambar nih, cek korelasi dengan topiknya: ",
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
