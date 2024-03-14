/* eslint-disable @typescript-eslint/no-explicit-any */

import { Splitter } from './splitter.js';
import { MarkdownDocument, Section } from '../../../../types/classes/markdown.js';
import { Paragraph } from '../../../../types/classes/loader.js';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { u } from 'unist-builder';
import { filter } from 'unist-util-filter';
import { encode } from 'gpt-3-encoder';

export class MarkdownSplitter extends Splitter {
  file: MarkdownDocument;

  constructor({ file }) {
    super();

    this.file = file;
    this.paragraphs = this.split();
  }

  /**
   * Splits a markdown document into paragraphs.
   * @returns A list of paragraphs created from the document
   */

  split = (): Paragraph[] => {
    const sections = this.getSections();

    // calculate token size for each paragraph
    const paragraphs = sections.map((section) => {
      const embedding = `${section.heading}\n${section.content}`;

      return {
        heading: section.heading,
        content: section.content,
        tokens: encode(embedding).length,
      };
    });

    return paragraphs;
  };

  /**
   * Splits a markdown document into sections using headers. It removes empty headers too.
   * @returns A list of heading/content pairs (sections) created from the document
   */

  private getSections = (): Section[] => {
    if (!this.file.body) return [];

    const mdxTree = fromMarkdown(this.file.body, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });

    const validElements = [
      'mdxjsEsm',
      'mdxJsxFlowElement',
      'mdxJsxTextElement',
      'mdxFlowExpression',
      'mdxTextExpression',
    ];

    // Remove all MDX elements from markdown
    const mdTree = filter(mdxTree, (node) => !validElements.includes(node.type));

    // If there are no valid MD elements remaining after removing MDX elements
    if (!mdTree) return [];

    const sectionTrees = this.splitTreeBy(mdTree, (node) => node.type === 'heading');

    const sections = sectionTrees.map((tree) => {
      const [firstNode] = tree.children;

      try {
        const heading = firstNode.type === 'heading' ? toString(firstNode) : undefined;

        const validTypes = ['paragraph', 'code', 'html', 'list', 'table', 'blockquote'];
        const hasNodes = tree?.children.some((item) => validTypes.includes(item.type));

        // If the heading has no matching content, then disregard it
        if (!hasNodes) return null;

        // this modifier removes the header from the content
        const modifier = { ...tree, children: tree.children.filter((item) => item.type !== 'heading') };

        // this formats the markdown tree into a paragraph
        const content = toMarkdown(modifier, { extensions: [gfmToMarkdown()] });

        return {
          heading: heading || 'Introduction',
          content: content.replace(/\n/g, ' '),
        };
      } catch (e) {
        console.log('Failed to parse markdown tree', e);
        console.log('Node:', firstNode);
      }
    });

    // filter any sections are are null because the header doesn't have a matching node
    return sections.filter((section) => section);
  };

  /**
   * Searches the markdown tree for eligible elements to split the document by
   * @param tree The full markdown tree to search
   * @param predicate The function to determine if an element is eligible to split on
   * @returns A list of eligible markdown elements in tree format created from the document
   */

  private splitTreeBy(tree: any, predicate: (node: any) => boolean) {
    return tree.children.reduce((trees, node) => {
      const [lastTree] = trees.slice(-1);

      if (!lastTree || predicate(node)) {
        const tree: any = u('root', [node]);
        return trees.concat(tree);
      }

      lastTree.children.push(node);
      return trees;
    }, []);
  }
}
