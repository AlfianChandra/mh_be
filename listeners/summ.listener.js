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
            content: `
            Kamu adalah asisten analisis diskusi yang bertugas menghasilkan insight atau hint dari topik dan konteks yang diberikan user.  
            Gunakan informasi teks dan gambar (jika ada) untuk memperkaya jawaban.  
            Jawaban harus ringkas tapi detail, terstruktur, dan praktis.  

            Output HARUS menggunakan format berikut:

            ## 🔑 Poin Utama
            - [Tuliskan poin-poin insight utama yang relevan dengan diskusi]

            ## 📌 Penjelasan Detail
            [Berikan uraian lengkap tentang masing-masing poin di atas, dengan penjelasan logis, hubungan antar ide, dan konteks tambahan jika ada]

            ## 🖼️ Insight dari Gambar (jika ada)
            - [Jelaskan informasi tambahan yang bisa ditarik dari gambar terkait topik]

            ## 💡 Contoh / Aplikasi Nyata
            - [Berikan 1-3 contoh nyata atau skenario praktis agar mudah dipahami]

            ## 🎯 Rekomendasi / Next Step
            - [Berikan saran tindakan, rekomendasi praktis, atau langkah selanjutnya yang bisa dilakukan user berdasarkan insight di atas]
            `,
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
                text: "Ini gambar dari user terkait fokus konteksnya. Gunakan gambar ini sebagai tambahan untuk memahami konteks.",
              },
              {
                type: "input_image",
                image_url: data.input_image, // pastikan ini URL base64 atau public-accessible
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
      const setting = data.setting;
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

    socket.on("summarization:request-quick-search", async (data) => {
      let input = [
        {
          role: "system",
          content:
            "Kamu adalah asisten yang bertugas untuk mencari informasi di internet sesuai dengan permintaan pengguna",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Berikut topik nya, silahkan pelajari topik ini sebagai data tambahan: " +
                data.topic,
            },
            {
              type: "input_text",
              text:
                "Cari di Wikipedia terkait kata kunci berikut: " +
                data.keyword +
                ". Langsung berikan penjelasan tanpa mengulang pertanyaan.",
            },
          ],
        },
      ];

      const response = await openai.responses.create({
        model: "gpt-4.1-mini-2025-04-14",
        tools: [{ type: "web_search" }],
        input,
      });

      for await (const res of response) {
        if (res.type === "message") {
          const content = res.content;
          for (const c of content) {
            if (c.type === "output_text") {
              {
                const text = c.text;
                const annotation = c.annotations;
                socket.emit("summarization:quick-search-delta", {
                  text,
                  annotation,
                });
              }
            }
          }
        }
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
