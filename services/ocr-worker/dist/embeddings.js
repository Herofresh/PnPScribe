import OpenAI from "openai";
import { config } from "./config.js";
import { listChunksMissingEmbeddings, updateChunkEmbedding } from "./db.js";
const openai = new OpenAI({
    apiKey: config.openAiApiKey,
});
function toVectorLiteral(values) {
    return `[${values.join(",")}]`;
}
export async function embedDocumentChunks(documentId) {
    const chunks = await listChunksMissingEmbeddings(documentId);
    if (chunks.length === 0) {
        return { embeddedCount: 0 };
    }
    let embeddedCount = 0;
    const batchSize = 32;
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const response = await openai.embeddings.create({
            model: config.embedModel,
            input: batch.map((chunk) => chunk.content),
        });
        for (let j = 0; j < batch.length; j += 1) {
            const vector = response.data[j]?.embedding;
            if (!Array.isArray(vector) || vector.length === 0) {
                throw new Error(`Missing embedding vector for chunk ${batch[j]?.id ?? "unknown"}`);
            }
            await updateChunkEmbedding(batch[j].id, toVectorLiteral(vector));
            embeddedCount += 1;
        }
    }
    return { embeddedCount };
}
