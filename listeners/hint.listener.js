import registry from "../utils/serviceregistry.utils.js";
import Meeting from "../models/meeting.model.js";
import Files from "../models/files.model.js";
import FileChunk from "../models/fileChunk.model.js";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

registry.waitFor("hintns", { timeoutMs: 1000 }).then((io) => {
  io.use(useSocketAuth);
  io.on("connection", async (socket) => {
    let openai = await getOpenAIInstance();
    console.log("Client connected to hint namespace:", socket.id);
    socket.on("hint:send-recipe", async (data) => {
      const hintType = data.hint_type;
      const setting = data.setting;
      const prompt = data.prompt;
      const transcription = data.transcription;
      const context = data.hint_context; // context for the hint
      const hintMedia = data.hint_media; //base64 image
      const structure = data.response_structure;
      const motion = data.motion || [];
      const useFiles = data.use_files || false;
      const idMeeting = data.id_meeting;

      //Forge the input
      let input = [];
      input.push({
        role: "system",
        content: `Kamu adalah asisten yang membantu pengguna dalam memberikan petunjuk/hint terkait konteks yang diberikan berupa gambar (hingga 10 frame video), dan teks transkripsi.
        Kamu akan mempelajari dan menggunakan pengetahuanmu untuk memberikan hint kepada pengguna.
        Kamu akan diberikan konteks penuh dan kamu akan mempelajari konteks itu. Pengguna akan meminta kamu untuk memberikan petunjuk/pengetahuan tentang konteks spesifik yang mereka berikan.
        Kamu belajar dari data teks (transkripsi percakapan) dengan data visual (gambar video capture) yang mengaitkan keduanya.
        Jangan mengulangi kata-kata yang telah diberikan. Jangan gunakan intro.

        Tugasmu adalah:
        1. Belajar dari transkripsi sebagai sumber utama narasi.
        2. Gunakan gambar sebagai petunjuk tambahan.
        3. Melainkan tarik insight dari hubungan antara teks + visual.
        4. Tetap gunakan struktur respon yang diminta pengguna.


        Berikut struktur respon yang harus kamu ikuti:
        ${structure}

        ## ATURAN KHUSUS UNTUK MERMAID DIAGRAM:
        ### FORMAT WAJIB:
        - HANYA gunakan block code markdown: \`\`\`mermaid
        - WAJIB mulai dengan SALAH SATU: flowchart TD, flowchart LR, graph TD, sequenceDiagram, classDiagram, stateDiagram-v2, mindmap
        - Jangan ada teks penjelasan di luar block code mermaid
        
        ### SINTAKS NODE YANG BENAR:
        - Kotak: A[Mulai_Proses]
        - Bulat: B(Input_Data)  
        - Diamond: C{Cek_Validasi}
        - Circle: D((Start))
        - Hexagon: E{{Process}}
        
        ### SINTAKS MINDMAP:
        - Root: root((Central_Topic))
        - Branch: A(Main_Branch)
        - Sub-branch: B[Sub_Topic]
        - Indentasi dengan spasi untuk hierarki
        
        ### ATURAN LABEL KETAT:
        - Label WAJIB berisi teks, minimal 2 karakter
        - Gunakan underscore _ untuk spasi: Input_Data bukan Input Data
        - Hindari karakter: " ' \` | # % & , ! @ $ ^ * + = \ / < >
        - Gunakan huruf dan angka saja: A-Z, a-z, 0-9, underscore _
        
        ### TEMPLATE YANG AMAN:
        
        **Flowchart:**
        \`\`\`mermaid
        flowchart TD
            A[Mulai] --> B[Input_Data]
            B --> C{Validasi_OK}
            C -->|Ya| D[Proses_Data]
            C -->|Tidak| E[Error_Message]
            D --> F[Selesai]
            E --> F
        \`\`\`
        
        **Mindmap:**
        \`\`\`mermaid
        mindmap
          root((Project_Management))
            Planning
              Requirements
              Timeline
              Resources
            Execution
              Development
              Testing
              Deployment
            Monitoring
              Progress_Tracking
              Quality_Control
        \`\`\`
        
        ### YANG DILARANG KERAS:
        - Node kosong: A[], B(), C{}, D(())
        - Karakter spesial dalam label: A[Data,Input], B(Test"ing)
        - Spasi dalam label: A[Input Data] ❌ → A[Input_Data] ✅
        - Label pendek: A[a] ❌ → A[Start] ✅
        - Mindmap tanpa root: harus selalu ada root((Topic))
        - Indentasi tidak konsisten di mindmap
        
        ### VALIDASI INTERNAL:
        Sebelum output, pastikan:
        1. Setiap node punya label minimal 2 karakter
        2. Tidak ada bracket kosong
        3. Semua connection valid dengan format: A --> B
        4. Diagram bisa dirender di mermaid.live
        
        Kalau jawaban kamu harus memberikan rumus matematika/formula, berikan formula tersebut dalam format LaTeX.
        Jika pengguna meminta tabel, berikan tabel dalam format markdown dan beri border.
        Berikan penjelasan yang cukup namun padan dan substansial. Penjelasan tidak selalu dalam bentuk poin-poin. Gunakan kombinasi antara paragraf dan poin.
        Gunakan bahasa indonesia.
        `,
      });

      if (useFiles) {
        const meeting = await Meeting.findById(idMeeting);
        const userVector = await getEmbedding(prompt);
        const results = await searchRelevantChunks(
          meeting._id.toString(),
          userVector,
          5
        );
        results.forEach((r) => console.log(r.score, r.chunk.substring(0, 100)));
        return;
      }

      if (hintType === "text") {
        input.push({
          role: "system",
          content: `Topik ini berujudul ${data.context_title}. Berikut adalah konteks penuh dari sesi pembahasan saat ini: ${transcription}.`,
        });

        input.push({
          role: "user",
          content: "Berikut adalah konteks yang diberikan pengguna: " + context,
        });

        if (prompt && prompt.length > 0) {
          input.push({
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Berikut adalah instruksi tambahan dari pengguna: ${prompt}`,
              },
            ],
          });
        }

        if (motion.length > 0) {
          input.push({
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Berikut adalah gambar-gambar yang diambil saat sesi meeting berlangsung. Gunakan gambar ini sebagai tambahan untuk memahami konteks...",
              },
              ...motion.map((img, idx) => ({
                type: "input_image",
                image_url: img, // pastikan ini URL base64 atau public-accessible
              })),
            ],
          });
        }
      } else {
        input.push({
          role: "system",
          content: `Konteks ini berujudul ${data.context_title}. Berikut adalah konteks penuh dari sesi pembahasan saat ini: ${transcription}`,
        });
        input.push({
          role: "user",
          content: [
            { type: "input_text", text: `${prompt}` },
            { type: "input_image", image_url: hintMedia },
          ],
        });
      }

      console.clear();
      const response = await openai.responses.create({
        model: setting.model,
        // reasoning: { effort: "medium" },
        input: input,
        temperature: 0.7,
        top_p: 0.8,
        // text: {
        //   verbosity: "medium",
        // },
        stream: true,
      });

      for await (const ev of response) {
        if (ev.delta !== undefined) {
          socket.emit("hint:response-delta", ev.delta);
        }
        if (ev.type === "response.completed") {
          console.log(ev.response);
          getKeywords(openai, ev.response.output[0].content[0].text, setting)
            .then((keywords) => {
              console.log(keywords);
              socket.emit("hint:response-complete", {
                text: ev.response.output[0].content[0].text,
                keywords: keywords,
              });
            })
            .catch((error) => {
              console.error("Error fetching keywords:", error);
            });
        }
      }
    });
    socket.on("disconnect", () => {
      logger.info(`[HINT] client left: ${socket.id}`);
    });
  });
});

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

const searchRelevantChunks = async (idMeeting, queryEmbedding, topN = 5) => {
  const allChunks = await FileChunk.find({ id_meeting: idMeeting });
  console.log(allChunks.length);
  const scored = allChunks.map((doc) => ({
    id_file: doc.id_file,
    chunk: doc.chunk,
    score: cosineSimilarity(queryEmbedding, doc.vector),
  }));

  // urutin descending score
  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
};

const getEmbedding = (text) => {
  return new Promise(async (res, rej) => {
    try {
      const openai = await getOpenAIInstance();
      openai.embeddings
        .create({
          model: "text-embedding-3-small",
          input: text,
          encoding_format: "float",
        })
        .then((result) => {
          res(result.data[0].embedding);
        });
    } catch (err) {
      rej(err);
    }
  });
};

async function getKeywords(openai, context, setting) {
  return new Promise(async (res, rej) => {
    try {
      const input = [
        {
          role: "system",
          content: `
          Tugasmu hanya menghasilkan top 10 daftar pertanyaan dari kata kunci teknis atau asing yang muncul dalam konteks.
          Hasilkan pertanyaan berupa:
          -Pengujian Ide Menarik
          -Praktikal
          -Perbandingan
          -Simulasi ekstrim
          -Simulasi perhitungan
          -Simulasi perbandingan
          -Simulasi skala
          -Studi kasus
          -Aplikasi nyata
          -Estimasi
          -Simulasi Absurd
          -Out-of-the Box Scenario

          Urutkan dari yang paling relevan dan penting, hingga yang umum.
          Jangan hasilkan pertanyaan yang jawabannya sudah jelas ada di konteks.
          Format output HARUS valid JSON array of strings.  
          Jangan tambahkan teks atau penjelasan lain di luar array.
          Berikan emoji yang berkaitan dengan pertanyaan di awal kalimat di setiap pertanyaan.
          Masing-masing pertanyaan singkat, maksimal 13 kata. 

          Contoh format output:  
          ["Apa itu X?", "Definisi dari X?", "Penjelasan tentang X?", "Bagaimana cara kerja X?", "Contoh penerapan X?"]

          `,
        },
        {
          role: "user",
          content: `Berikut konteksnya: ${context}. Hasilkan daftar pertanyaan dalam format JSON array string tanpa penjelasan tambahan.`,
        },
      ];

      const response = await openai.responses.create({
        model: setting.model,
        input,
        stream: false,
      });
      return res(JSON.parse(response.output[0].content[0].text));
    } catch (err) {
      console.error(err);
      rej(err);
    }
  });
}

async function getOpenAIInstance() {
  const openai = await registry.waitFor("openai");
  return openai;
}
