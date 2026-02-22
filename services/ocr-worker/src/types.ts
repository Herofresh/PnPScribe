export interface OcrDocumentJobPayload {
  documentId: string;
  requestedAt: string;
  mode: "replace" | "supplement";
  fullRun: boolean;
}

export interface ChunkRow {
  id: string;
  content: string;
}
