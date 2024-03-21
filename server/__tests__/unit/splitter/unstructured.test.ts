const document = `Ireland (Irish: Éire [ˈeːɾʲə] ⓘ), also known as the Republic of Ireland (Poblacht na hÉireann),[a] is a country in north-western Europe consisting of 26 of the 32 counties of the island of Ireland. The capital and largest city is Dublin, on the eastern side of the island. Around 2.1 million of the country's population of 5.15 million people reside in the Greater Dublin Area.[9] The sovereign state shares its only land border with Northern Ireland, which is part of the United Kingdom. It is otherwise surrounded by the Atlantic Ocean, with the Celtic Sea to the south, St George's Channel to the south-east, and the Irish Sea to the east. It is a unitary, parliamentary republic.[10] The legislature, the Oireachtas, consists of a lower house, Dáil Éireann; an upper house, Seanad Éireann; and an elected president (Uachtarán) who serves as the largely ceremonial head of state, but with some important powers and duties. The head of government is the Taoiseach (Prime Minister, literally "Chief"), who is elected by the Dáil and appointed by the President, who appoints other government ministers. The Irish Free State was created with Dominion status in 1922, following the Anglo-Irish Treaty. In 1937, a new constitution was adopted, in which the state was named "Ireland" and effectively became a republic, with an elected non-executive president. It was officially declared a republic in 1949, following the Republic of Ireland Act 1948. Ireland became a member of the United Nations in 1955. It joined the European Communities (EC), the predecessor of the European Union (EU), in 1973. The state had no formal relations with Northern Ireland for most of the 20th century, but the 1980s and 1990s saw the British and Irish governments working with Northern Irish parties to resolve the conflict that had become known as the Troubles. Since the signing of the Good Friday Agreement in 1998, the Irish government and Northern Irish government have co-operated on a number of policy areas under the North/South Ministerial Council created by the Agreement. Ireland is a developed country with a quality of life that ranks amongst the highest in the world; after adjustments for inequality, the 2021 Human Development Index listing ranked it the sixth-highest in the world.[11] It also ranks highly in healthcare, economic freedom, and freedom of the press.[12][13] It is a member of the EU and a founding member of the Council of Europe and the OECD. The Irish government has followed a policy of military neutrality through non-alignment since before World War II, and the country is consequently not a member of NATO,[14] although it is a member of Partnership for Peace and certain aspects of PESCO. Ireland's economy is advanced,[15] with one of Europe's major financial hubs being centred around Dublin. It ranks among the top ten wealthiest countries in the world in terms of both GDP and GNI per capita.[16][17][18][19] After joining the EC, the country's government enacted a series of liberal economic policies that helped to boost economic growth between 1995 and 2007, a time now often referred to as the Celtic Tiger period. A recession and reversal in growth then followed during the Great Recession, which was exacerbated by the bursting of the Irish property bubble.[20]
Name
Main article: Names of the Irish state
The Irish name for Ireland is Éire, deriving from Ériu, a goddess in Irish mythology.[21] The state created in 1922, comprising 26 of the 32 counties of Ireland, was "styled and known as the Irish Free State" (Saorstát Éireann).[22] The Constitution of Ireland, adopted in 1937, says that "the name of the State is Éire, or, in the English language, Ireland". Section 2 of the Republic of Ireland Act 1948 states, "It is hereby declared that the description of the State shall be the Republic of Ireland." The 1948 Act does not name the state "Republic of Ireland", because to have done so would have put it in conflict with the Constitution.[23]
The government of the United Kingdom used the name "Eire" (without the diacritic) and, from 1949, "Republic of Ireland", for the state.[24] It was not until the 1998 Good Friday Agreement, when the state dropped its claim to Northern Ireland, that it began calling the state "Ireland".[25][26]
The state is also informally called "the Republic", "Southern Ireland" or "the South";[27] especially when distinguishing the state from the island or when discussing Northern Ireland ("the North"). Irish republicans reserve the name "Ireland" for the whole island[26] and often refer to the state as "the Free State", "the 26 Counties",[26][28] or "the South of Ireland".[29] This is a "response to the partitionist view [...] that Ireland stops at the border".[30]
History
Main article: History of the Republic of Ireland
For the history of the entire island, see History of Ireland.
Home-rule movement
Main article: Home Rule movement 
From the Act of Union on 1 January 1801, until 6 December 1922, the island of Ireland was part of the United Kingdom of Great Britain and Ireland. During the Great Famine, from 1845 to 1849, the island's population of over 8 million fell by 30%. One million Irish died of starvation and disease and another 1.5 million emigrated, mostly to the United States.[31] This set the pattern of emigration for the century to come, resulting in constant population decline up to the 1960s.The Irish Parliamentary Party was formed in 1882 by Charles Stewart Parnell (1846–1891). Charles Stewart Parnell addressing a meeting.
From 1874, and particularly under Charles Stewart Parnell from 1880, the Irish Parliamentary Party gained prominence. This was firstly through widespread agrarian agitation via the Irish Land League, which won land reforms for tenants in the form of the Irish Land Acts, and secondly through its attempts to achieve Home Rule, via two unsuccessful bills which would have granted Ireland limited national autonomy. These led to "grass-roots" control of national affairs, under the Local Government Act 1898, that had been in the hands of landlord-dominated grand juries of the Protestant Ascendancy.Home Rule seemed certain when the Parliament Act 1911 abolished the veto of the House of Lords, and John Redmond secured the Third Home Rule Act in 1914. However, the Unionist movement had been growing since 1886 among Irish Protestants after the introduction of the first home rule bill, fearing discrimination and loss of economic and social privileges if Irish Catholics achieved real political power. In the late 19th and early 20th-century unionism was particularly strong in parts of Ulster, where industrialisation was more common in contrast to the more agrarian rest of the island, and where the Protestant population was more prominent, with a majority in four counties.[35] Under the leadership of the Dublin-born Sir Edward Carson of the Irish Unionist Party and the Ulsterman Sir James Craig of the Ulster Unionist Party, unionists became strongly militant, forming Ulster Volunteers in order to oppose "the Coercion of Ulster".[36] After the Home Rule Bill passed parliament in May 1914, to avoid rebellion with Ulster, the British Prime Minister H. H. Asquith introduced an Amending Bill reluctantly conceded to by the Irish Party leadership. This provided for the temporary exclusion of Ulster from the workings of the bill for a trial period of six years, with an as yet undecided new set of measures to be introduced for the area to be temporarily excluded.`;

import { describe, expect, test } from '@jest/globals';
import { UnstructuredTextSplitter } from '../../../libs/services/documents/splitter/unstructured';

describe('UnstructuredSplitter Class Tests', () => {
  test('Split a unstructured paragraph to default size chunks', () => {
    const splitter = new UnstructuredTextSplitter({ file: document });
    const paragraphs = splitter.split();

    expect(paragraphs.length).toBe(8);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(1000);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(1613);
  });

  test('Split a unstructured paragraph to large size chunks', () => {
    const splitter = new UnstructuredTextSplitter({ file: document });
    const chunkSize = 1500; // Selecting a random chunk size
    const paragraphs = splitter.split(chunkSize);

    expect(paragraphs.length).toBe(6);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(chunkSize);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(1612);
  });

  test('Split a unstructured paragraph to small size chunks', () => {
    const splitter = new UnstructuredTextSplitter({ file: document });
    const chunkSize = 500; // Selecting a random chunk size
    const paragraphs = splitter.split(chunkSize);

    expect(paragraphs.length).toBe(16);

    paragraphs.forEach((paragraph) => {
      expect(paragraph.content.length).toBeGreaterThan(0);
      expect(paragraph.tokens).toBeGreaterThan(0);

      expect(paragraph.tokens).toBeLessThanOrEqual(chunkSize);
    });

    expect(paragraphs.reduce((total, paragraph) => total + paragraph.tokens, 0)).toBe(1622);
  });
});
