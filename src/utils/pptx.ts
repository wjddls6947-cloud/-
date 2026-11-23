import JSZip from 'jszip';

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTextFromSlideXml(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/g);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const matches = para.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (!matches) continue;
    const line = matches
      .map((tag) => decodeXmlEntities(tag.replace(/<a:t[^>]*>|<\/a:t>/g, '')))
      .join('')
      .trim();
    if (line.length > 0) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

export async function extractTextFromPptxFile(
  file: File
): Promise<{ text: string; slideCount: number }> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    throw new Error('PPTX 파일 내부에서 슬라이드를 찾을 수 없습니다.');
  }

  const noteEntries = new Map<number, string>();
  for (const name of Object.keys(zip.files)) {
    const match = name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/i);
    if (match) {
      noteEntries.set(Number(match[1]), name);
    }
  }

  const sections: string[] = [];
  for (const slidePath of slideEntries) {
    const slideNum = Number(slidePath.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
    const slideXml = await zip.files[slidePath].async('string');
    const slideText = extractTextFromSlideXml(slideXml);

    let noteText = '';
    const notePath = noteEntries.get(slideNum);
    if (notePath && zip.files[notePath]) {
      const noteXml = await zip.files[notePath].async('string');
      noteText = extractTextFromSlideXml(noteXml);
    }

    if (slideText || noteText) {
      let block = `[슬라이드 ${slideNum}]`;
      if (slideText) block += `\n${slideText}`;
      if (noteText) block += `\n[발표자 노트]\n${noteText}`;
      sections.push(block);
    }
  }

  const combined = sections.join('\n\n').trim();
  if (!combined) {
    throw new Error(
      'PPTX 슬라이드에서 읽을 수 있는 텍스트를 찾지 못했습니다. 슬라이드가 이미지로만 구성된 경우 PDF로 내보내어 업로드해주세요.'
    );
  }

  return {
    text: combined.slice(0, 80000),
    slideCount: slideEntries.length,
  };
}
