import { decode } from 'html-entities';
import { convert } from 'html-to-text';
import { encode } from 'gpt-3-encoder';
import { Splitter } from './splitter.js';
import { IntercomResource, TelnyxBucketChunk } from '../types';

// Regex Patterns
const i_tags = /<\/i>/g;
const i_open_tags = /<\/i>/g;
const b_tags = /<\/b>/g;
const b_open_tags = /<b>/g;
const h_tags = /<h[\S\s]*?<\/h.>/g;
const strip_headers = /(?<=\>)(?!\<)(.*)(?=\<)(?<!\>)/g;
const strip_html = /<([\S\s]|\n)*?>/g;
const a_tags = /<a[\S\s]*?<\/a>/g;
const a_href = /href=\\?"([^"]*)\\?/g;
const table_tags = /<table[\S\s]*?<\/table>/g;
const table_rows = /<tr[\S\s]*?<\/tr>/g;
const image_tags = /<img[\S\s]*?\"?>/g;
const iframe_tags = /<iframe[\S\s]*?<\/iframe>/g;
const extract_src = /src=\\?"([^"\\]*)/g;
const extract_intercom_anchor = /#h_[a-z0-9]{0,10}/g;

// Constants
const EXCLUDE_IMAGES = ['https://downloads.intercomcdn.com/i/o/226483939/ed2cce9ed61fd46892a4a082/line.png'];

export class IntercomSplitter extends Splitter {
  article: IntercomResource;
  title: string;
  body: string;

  constructor({ article }) {
    super();

    this.article = article;
    this.title = article.title;
    this.body = article.body;
    this.chunks = this.split();
  }

  /**
   * Splits an Intercom document into chunks.
   * @returns A list of chunks created from the document
   */

  split = (): TelnyxBucketChunk[] => {
    const input = this.intercomToMarkdown();
    const splits = input.split(h_tags);
    const headers = input.match(h_tags);

    if (!headers || headers?.length === 0) {
      this.chunks = this.formatNoHeaders(input);
      return this.chunks;
    }

    const EXCLUDE = ["Can't find what you're looking for?"];

    const headers_stripped = [
      'Introduction',
      ...headers
        .map((header) => header.match(strip_headers)?.toString().replace(':', '').trim())
        .filter((item) => !EXCLUDE.includes(item) && item),
    ];

    this.chunks = this.formatWithHeaders(splits, headers_stripped);
    return this.chunks;
  };

  /**
   * Converts Intercom HTML to Markdown using Regex.
   * @returns A list of chunks for the document, divided by headings
   */

  private intercomToMarkdown = () => {
    try {
      const { body, url } = this.article;

      // Remove tab characters
      const tabs_removed = body.replaceAll('\t', '');

      // Decode HTML entities
      const html_entities_removed = decode(tabs_removed);

      // Convert HTML tables to Markdown tables
      const convert_tables = this.convertTables(html_entities_removed, url);

      // Remove headers if they are empty
      const remove_empty_headers = this.removeEmptyHeaders(convert_tables);

      // Convert image tags to Markdown image syntax
      const convert_images = this.convertImages(remove_empty_headers);

      // Convert hyperlinks to Markdown link syntax
      const convert_links = this.convertLinks(convert_images, url);

      // Convert video embeds to Markdown or a suitable format
      const convert_videos = this.convertVideos(convert_links);

      return convert_videos;
    } catch (e) {
      // Return original body or an empty string if an error occurs
      return this.body || '';
    }
  };

  /**
   * Converts Intercom HTML tables into a chunk with 1st column as the header and 2nd column as the body.
   * @todo Add support for more than 2 columns
   * @param input The content with HTML tables
   * @param url The URL of the article, used to parse Intercom anchor tags as links
   * @returns The content with all table rows converted to chunks
   */

  private convertTables = (input, url) => {
    const tables = input.match(table_tags);

    if (!tables) return input;

    for (const table of tables) {
      const rows = this.convertLinks(table, url).match(table_rows);

      for (const row of rows) {
        const cells = row.match(/<td[\S\s]*?<\/td>/g);
        if (cells?.length < 2) continue;

        const title = cells[0].match(strip_headers)?.[0].replaceAll('\n', '');
        const body = cells[1]
          .match(strip_headers)
          ?.map((item) => item.replaceAll('\n', ''))
          .join(' ');

        input = input.replace(cells[0], `<h1>${title}</h1>`);
        input = input.replace(cells[1], body);
      }
    }

    return input;
  };

  /**
   * Remove any header tags added to the document that are blank
   * @param input The content with empty header tags
   * @returns The content without empty header tags
   */

  private removeEmptyHeaders = (input) => {
    let input_copy = input;

    const headers = input.match(h_tags);
    if (!headers || headers?.length === 0) return input;

    const header_check = headers.map((header) => header.match(strip_headers));

    for (const index in header_check) {
      const header = header_check[index];
      if (header === null) {
        input_copy = input_copy.replaceAll(headers[index], '');
      }
    }

    return input_copy;
  };

  /**
   * Converts img tags into markdown images
   * @param input The HTML content with <img> tags
   * @returns The HTML content with markdown images
   */

  private convertImages = (input) => {
    const images = input.match(image_tags);

    for (const index in images) {
      const image = images[index];

      const url = image.match(extract_src)?.[0]?.replace('src="', '').replace('src=\\"', '');
      const name = url?.split('/').pop();
      const md_url = `![${name}](${url})`;

      if (!EXCLUDE_IMAGES.some((item) => url.includes(item))) {
        input = input.replaceAll(image, md_url ? ` ${md_url} ` : 'video not found');
      }
    }

    return input;
  };

  /**
   * Converts video tags into a Markdown videos
   * @param input The HTML content with <video> tags
   * @returns The HTML content with markdown videos
   */

  private convertVideos = (input) => {
    const videos = input.match(iframe_tags);

    for (const index in videos) {
      const video = videos[index];

      let url = video.match(extract_src)?.[0]?.replace('src="', '').replace('src=\\"', '');
      if (url?.includes('vimeo')) url = `https://vimeo.com/${url.split('/video/')?.[1]}`;

      const md_url = `[${url}](${url})`;
      input = input.replaceAll(video, md_url ? ` ${md_url} _videoEnd` : 'video not found');
    }

    return input;
  };

  /**
   * Converts HTML links into Markdown links
   * @param input The HTML content with <a> tags
   * @returns The HTML content with markdown links
   */

  private convertLinks = (input, url) => {
    const links = input.match(a_tags);

    for (const index in links) {
      const link = links[index];

      const hyperlink = link.match(strip_headers);
      let href = link.match(a_href)?.[0]?.replace('href="', '').replace('href=\\"', '');

      // if an anchor link is used, this will format it to work correctly with the current article
      if (extract_intercom_anchor.test(href)) href = `${url}${href}`;

      const finalLink = hyperlink && href ? `[${hyperlink}](${href})` : href ? `<${href}>` : 'link not found ';

      // replace all the links in the original text with the new formatted link
      input = input.replaceAll(link, finalLink);
    }

    return input;
  };

  /**
   * Removes some weird <b> tags added by Intercom
   * @param input The HTML content with <b> tags
   * @returns The HTML content without <b> tags
   */

  private removeAllTags = (input) => {
    return input.replace(b_tags, '').replace(b_open_tags, '').replace(i_tags, '').replace(i_open_tags, '');
  };

  /**
   * A helper function for converting a document with no headers into a single chunk
   * @param document The document that needs to be converted to a chunk
   * @returns The chunk created from the document
   */

  private formatNoHeaders = (document): TelnyxBucketChunk[] => {
    const content = document.replace(strip_html, '').replaceAll('\n', '');
    const embedding = `${this.title}\n${this.title || 'Introduction'}\n${content}`;

    return [
      {
        tokens: encode(embedding)?.length,
        heading: this.title || 'Introduction',
        content: convert(document, { wordwrap: null }).replaceAll('\n\n\n', '\n').replaceAll(' _videoEnd', ' '),
      },
    ];
  };

  /**
   * A helper function for converting a document with at least one header into a list of chunks
   * @param splits An array of each chunks content created by splitting the document by headers
   * @param headers_striped An array of all headers in the document
   * @returns A list of chunks created from the document
   */

  private formatWithHeaders = (splits, headers_striped): TelnyxBucketChunk[] => {
    const chunks = [];

    for (const i in splits) {
      const title = headers_striped[i];
      const last = chunks[parseInt(i) - 1];

      if (title) {
        const headingContent = last?.body === '' ? `${last.title}\n${title}` : title;
        const heading = this.removeAllTags(headingContent);

        const content = splits[i].replace(strip_html, '').replaceAll('\n', '');
        const embedding = `${this.title}\n${heading}\n${content}`;

        chunks.push({
          tokens: encode(embedding)?.length,
          heading,
          content: convert(splits[i], { wordwrap: null }).replaceAll('\n\n\n', '\n').replaceAll(' _videoEnd', ' '),
        });
      }
    }

    return chunks.filter((item) => item.content);
  };
}
