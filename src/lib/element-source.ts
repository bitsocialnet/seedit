if (import.meta.env.DEV && typeof window !== 'undefined') {
  const notReady = async () => ({
    error: 'element-source is not ready yet.',
  });

  const elementSourceApi: any = {
    ready: false,
    error: null,
    resolve: notReady,
    resolveBySelector: notReady,
    resolveAtPoint: notReady,
    formatStack: () => '',
  };
  (window as any).__ELEMENT_SOURCE__ = elementSourceApi;

  import('element-source')
    .then(({ formatStack, resolveElementInfo }) => {
      const resolve = async (node: unknown) => {
        if (!(node instanceof Element)) {
          return {
            error: 'Expected a DOM Element.',
          };
        }

        try {
          const info = await resolveElementInfo(node);
          return {
            ...info,
            available: Boolean(info.source || info.stack.length || info.componentName),
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      };

      Object.assign(elementSourceApi, {
        ready: true,
        resolve,
        resolveBySelector: async (selector: string) => {
          const element = document.querySelector(selector);
          if (!(element instanceof Element)) {
            return {
              error: `No element matched selector: ${selector}`,
            };
          }
          return resolve(element);
        },
        resolveAtPoint: async (x: number, y: number) => {
          const element = document.elementFromPoint(x, y);
          if (!(element instanceof Element)) {
            return {
              error: `No element found at point (${x}, ${y})`,
            };
          }
          return resolve(element);
        },
        formatStack: (stack: unknown, maxLines = 3) => (Array.isArray(stack) ? formatStack(stack as any, maxLines) : ''),
      });
    })
    .catch((error) => {
      elementSourceApi.error = error instanceof Error ? error.message : String(error);
    });
}
