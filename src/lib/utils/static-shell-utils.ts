// True while React renders over the static first frame that index.html shows during startup
// (scripts/vite-static-shell.mjs), and while that frame is rendered at build time. Anything a
// component picks at random on mount should use a fixed choice then, so replacing the static
// frame does not visibly change it.
export const isStaticShellFrame = () => typeof window !== 'undefined' && (window.STATIC_SHELL_RENDER === true || !!document.querySelector('#root > [data-static-shell]'));
