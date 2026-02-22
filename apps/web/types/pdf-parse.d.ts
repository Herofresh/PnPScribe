declare module "pdf-parse" {
  export interface PdfParseResult {
    text?: string;
  }

  export class PDFParse {
    constructor(options: { data: Buffer | Uint8Array });
    getText(): Promise<PdfParseResult>;
    destroy?(): Promise<void>;
  }
}
