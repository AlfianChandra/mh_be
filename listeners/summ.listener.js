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
            content: `Kasih clue/hint tentang topik yang diberikan user. Buat dalam bentuk poin-poin. Sekalian berikan contohnya. Jangan mengulangi kalimat yang diminta, langsung berikan jawabannya. Gunakan informasi pada gambar untuk membantu menjawab.`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Ini keseluruhan diskusinya: " + data.input_text,
              },
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
                text: "Ini gambar dari user terkait fokus konteksnya",
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

    socket.on("summarization:request-aor", async (data) => {
      try {
        let input = [
          {
            role: "system",
            content: `Kamu akan membantu menjelaskan apapun yang ditanyakan user mengenai topik yang diberikan. Jelaskan secara langsung tanpa mengulang kalimat yang diminta`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Ini keseluruhan diskusinya: ${data.input_topic}`,
              },
              {
                type: "input_text",
                text: `Ini konteksnya: ${data.input_context}`,
              },
              {
                type: "input_text",
                text: `Respon atau pertanyaan: ${data.input_prompt}`,
              },
            ],
          },
        ];

        const response = await openai.responses.create({
          model: data.setting.model,
          input: input,
          stream: true,
        });

        for await (const res of response) {
          if (res.delta !== undefined) {
            socket.emit("summarization:aor-response-delta", res.delta);
          }

          if (res.type === "response.completed") {
            socket.emit("summarization:aor-response-complete");
          }
        }
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("summarization:request-qq", async (data) => {
      try {
        let input = [
          {
            role: "system",
            content: `
            Tugasmu hanya menghasilkan top 10 daftar pertanyaan dari kata kunci teknis atau asing yang muncul dalam konteks.
            Urutkan dari yang paling relevan dan penting, hingga yang umum.
            Jangan hasilkan pertanyaan yang jawabannya sudah jelas ada di konteks.
            Format output HARUS valid JSON array of strings.  
            Jangan tambahkan teks atau penjelasan lain di luar array.
            Berikan emoji yang berkaitan dengan pertanyaan di awal kalimat di setiap pertanyaan. 

            Contoh format output:  
            ["Apa itu X?", "Definisi dari X?", "Penjelasan tentang X?", "Bagaimana cara kerja X?", "Contoh penerapan X?"]
            `,
          },
          {
            role: "user",
            content: `Berikut konteksnya: ${data.input_context}. Hasilkan daftar pertanyaan dalam format JSON array string tanpa penjelasan tambahan.`,
          },
        ];

        const response = await openai.responses.create({
          model: setting.model,
          input,
          stream: false,
        });

        socket.emit(
          "summarization:aor-response-qq",
          JSON.parse(response.output[0].content[0].text)
        );
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
