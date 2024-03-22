const INTERCOM_SAMPLE_ARTICLE = {
  id: '8487192',
  type: 'article',
  workspace_id: 'ltcafuzd',
  parent_id: null,
  parent_type: null,
  parent_ids: [],
  title: 'Costa Rica DID Requirements',
  description: 'Here you will find all of the requirements for purchasing numbers in Costa Rica.',
  body: '<p class="no-margin"></p>\n<h2 id="h_fa4fca8492"><b>National Numbers in Costa Rica</b></h2>\n<p class="no-margin">For personal identity verification:</p>\n<p class="no-margin">* Name, last name</p>\n<p class="no-margin">* Contact phone number</p>\n<p class="no-margin">* Passport or ID copy</p>\n<p class="no-margin"></p>\n<p class="no-margin">For business identity verification:</p>\n<p class="no-margin">* Name, last name</p>\n<p class="no-margin">* Contact phone number</p>\n<p class="no-margin">* Passport or ID copy</p>\n<p class="no-margin">* Company name</p>\n<p class="no-margin">* Company incorporation certificate copy<br><br>For address verification:<br>* Address worldwide (street, building number, postal code, city and country)</p>\n<p class="no-margin"></p>\n<h2 id="h_a8c28d38e2"><b>Toll-free Numbers in Costa Rica</b></h2>\n<p class="no-margin">For personal identity verification:</p>\n<p class="no-margin">* Name, last name</p>\n<p class="no-margin">* Contact phone number</p>\n<p class="no-margin">* Passport or ID copy</p>\n<p class="no-margin"></p>\n<p class="no-margin">For business identity verification:</p>\n<p class="no-margin">* Name, last name</p>\n<p class="no-margin">* Contact phone number</p>\n<p class="no-margin">* Passport or ID copy</p>\n<p class="no-margin">* Company name</p>\n<p class="no-margin">* Company incorporation certificate copy<br>*Power of attorney stating the person who is eligible to represent the company<br><br>For address verification:<br>* Address worldwide (street, building number, postal code, city and country)<br>* Proof of address (dated within 3 months)</p>',
  author_id: 4637008,
  state: 'published',
  created_at: 1697570263,
  updated_at: 1697575323,
  url: 'https://support.telnyx.com/en/articles/8487192-costa-rica-did-requirements',
};

import { describe, expect, test } from '@jest/globals';
import { IntercomSplitter } from '../../../libs/services/documents/splitter/intercom';
import intercomJson from '../../assets/intercom_example_articles.json';

const INTERCOM_ARTICLES = intercomJson.data;

describe('IntercomSplitter Class Tests', () => {
  test('Split to default size chunks', () => {
    const splitter = new IntercomSplitter({ article: INTERCOM_SAMPLE_ARTICLE });

    const paragraphs = splitter.split();

    expect(paragraphs.length).toBe(2);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(1000);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(186);
  });

  test('Split multiple articles default size chunks', () => {
    INTERCOM_ARTICLES.forEach((article) => {
      const splitter = new IntercomSplitter({ article });

      const paragraphs = splitter.split();

      paragraphs.forEach((paragraph) => {
        expect(paragraph.tokens).toBeLessThanOrEqual(1000);
      });
    });
  });
});
