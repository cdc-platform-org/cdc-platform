// Pure, immutable edits on a design document (pages + elements). Kept apart
// from React/Fabric so they are trivial to reason about and to undo.
import type { DesignElement, DesignPage, DesignTemplate } from '../../types/designTemplate';

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function withPage(doc: DesignTemplate, pageIndex: number, change: (page: DesignPage) => DesignPage): DesignTemplate {
  return { ...doc, pages: doc.pages.map((page, index) => (index === pageIndex ? change(page) : page)) };
}

export function findElement(doc: DesignTemplate, pageIndex: number, id: string | null): DesignElement | undefined {
  if (!id) return undefined;
  return doc.pages[pageIndex]?.elements.find((element) => element.id === id);
}

export function updateElement(doc: DesignTemplate, pageIndex: number, id: string, patch: Partial<DesignElement>): DesignTemplate {
  return withPage(doc, pageIndex, (page) => ({
    ...page,
    elements: page.elements.map((element) => (element.id === id ? { ...element, ...patch } as DesignElement : element)),
  }));
}

export function replaceElement(doc: DesignTemplate, pageIndex: number, next: DesignElement): DesignTemplate {
  return withPage(doc, pageIndex, (page) => ({
    ...page, elements: page.elements.map((element) => (element.id === next.id ? next : element)),
  }));
}

export function addElement(doc: DesignTemplate, pageIndex: number, element: DesignElement): DesignTemplate {
  return withPage(doc, pageIndex, (page) => ({ ...page, elements: [...page.elements, element] }));
}

export function removeElement(doc: DesignTemplate, pageIndex: number, id: string): DesignTemplate {
  return withPage(doc, pageIndex, (page) => ({ ...page, elements: page.elements.filter((element) => element.id !== id) }));
}

export function duplicateElement(doc: DesignTemplate, pageIndex: number, id: string): { doc: DesignTemplate; newId: string | null } {
  const source = findElement(doc, pageIndex, id);
  if (!source) return { doc, newId: null };
  const copy = { ...source, id: newId(source.type), xMm: source.xMm + 5, yMm: source.yMm + 5, locked: false } as DesignElement;
  return { doc: addElement(doc, pageIndex, copy), newId: copy.id };
}

// direction 1 = one step towards the front (later in the array).
export function moveElement(doc: DesignTemplate, pageIndex: number, id: string, direction: 1 | -1): DesignTemplate {
  return withPage(doc, pageIndex, (page) => {
    const elements = [...page.elements];
    const index = elements.findIndex((element) => element.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= elements.length) return page;
    [elements[index], elements[target]] = [elements[target], elements[index]];
    return { ...page, elements };
  });
}

export function setPageBackground(doc: DesignTemplate, pageIndex: number, color: string): DesignTemplate {
  return withPage(doc, pageIndex, (page) => ({
    ...page,
    background: page.background && typeof page.background === 'object' ? { ...page.background, color } : color,
  }));
}

export function addPage(doc: DesignTemplate, afterIndex: number, copyFrom?: number): DesignTemplate {
  const pages = [...doc.pages];
  const source = copyFrom !== undefined ? doc.pages[copyFrom] : undefined;
  const page: DesignPage = source
    ? { ...source, id: newId('p'), elements: source.elements.map((element) => ({ ...element, id: newId(element.type) })) }
    : { id: newId('p'), elements: [] };
  pages.splice(afterIndex + 1, 0, page);
  return { ...doc, pages };
}

export function removePage(doc: DesignTemplate, pageIndex: number): DesignTemplate {
  if (doc.pages.length <= 1) return doc;
  return { ...doc, pages: doc.pages.filter((_, index) => index !== pageIndex) };
}

export function movePage(doc: DesignTemplate, pageIndex: number, direction: 1 | -1): DesignTemplate {
  const target = pageIndex + direction;
  if (target < 0 || target >= doc.pages.length) return doc;
  const pages = [...doc.pages];
  [pages[pageIndex], pages[target]] = [pages[target], pages[pageIndex]];
  return { ...doc, pages };
}
