// schema.org @graph builders — stable @ids so entities link rather than duplicate
// across pages (contracts/content-schema.md §3, research R4).
import { ORG, PRODUCT_NAME, SITE_ORIGIN } from './site';

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: ORG.name,
    url: ORG.url,
    logo: ORG.logo,
    sameAs: ORG.sameAs,
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: PRODUCT_NAME,
    url: SITE_ORIGIN,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    inLanguage: 'pt-BR',
  };
}

export function webPageNode(url: string, opts: { name: string; description: string }) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    inLanguage: 'pt-BR',
  };
}

export function softwareApplicationNode(opts: { description: string; availability?: string }) {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_ORIGIN}/#product`,
    name: PRODUCT_NAME,
    applicationCategory: 'FinanceApplication',
    description: opts.description,
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      availability: opts.availability ?? 'https://schema.org/PreOrder',
    },
    inLanguage: 'pt-BR',
  };
}

export function articleNode(
  url: string,
  opts: { headline: string; description: string; datePublished: string; dateModified: string },
) {
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: opts.headline,
    description: opts.description,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified,
    author: { '@id': `${SITE_ORIGIN}/#organization` },
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    mainEntityOfPage: { '@id': `${url}#webpage` },
    inLanguage: 'pt-BR',
  };
}

export function faqPageNode(url: string, qa: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: qa.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function breadcrumbListNode(url: string, items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function graph(nodes: object[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
