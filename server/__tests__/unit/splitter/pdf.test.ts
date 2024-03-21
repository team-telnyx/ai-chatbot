import { describe, expect, test } from '@jest/globals';
import { PDFSplitter } from '../../../libs/services/documents/splitter/pdf.js';

import PDFParser from 'pdf2json';
import axios from 'axios';

async function pdfToDocument(url: string): Promise<string> {
  const pdfParser = new PDFParser();

  const request = await axios.get(url, { responseType: 'arraybuffer' });
  const dataBuffer = Buffer.from(request.data);

  const data = await new Promise((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData) => reject(new Error(errData)));
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      const textContent = pdfData.Pages.map((page) =>
        page.Texts.map((text) => decodeURIComponent(text.R.map((r) => r.T).join(' '))).join(' ')
      ).join('\n');

      resolve(textContent);
    });

    pdfParser.parseBuffer(dataBuffer);
  });

  return data as string;
}

interface Document {
  url: string;
  data: string;
}

function getDocumentFromUrl(url: string) {
  let document: Document | null = null;
  return async function _getDocument(): Promise<string> {
    if (!!document) {
      return document.data;
    }
    const data = await pdfToDocument(url);
    document = {
      url,
      data,
    };
    return data;
  };
}

const getDocument = getDocumentFromUrl(
  'https://people.mpi-sws.org/~rossberg/papers/Haas,%20Rossberg,%20Schuff,%20Titzer,%20Gohman,%20Wagner,%20Zakai,%20Bastien,%20Holman%20-%20Bringing%20the%20Web%20up%20to%20Speed%20with%20WebAssembly.pdf'
);

describe('PDFSplitter Class', () => {
  test(`split method`, async () => {
    // Download PDF from a url
    const document = await getDocument();
    const splitter = new PDFSplitter({ file: document });
    const paragraphs = splitter.split();

    expect(paragraphs.length).toBe(16);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(2000);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(22287);
  });

  test(`splitOnText method with large chunkSize`, async () => {
    // Download PDF from a url
    const document = await getDocument();
    const splitter = new PDFSplitter({ file: document });
    const chunkSize = 1044; // Selecting a random chunk size
    const paragraphs = splitter.splitOnText(document, chunkSize);

    expect(paragraphs.length).toBe(80);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(chunkSize);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(22392);
  });

  test(`splitOnText method with small chunkSize`, async () => {
    // Download PDF from a url
    const document = await getDocument();

    const splitter = new PDFSplitter({ file: document });
    const chunkSize = 102; // Selecting a random chunk size
    const paragraphs = splitter.splitOnText(document, chunkSize);

    expect(paragraphs.length).toBe(811);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(chunkSize);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(23158);
  });
});
