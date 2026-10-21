import { getAllTags, type Tag } from '../background/common/tags';

/** Forge inserts/replaces its tag rows after navigation and trace completion. */
export function watchTagResults(mount: (tag: Tag, score: number) => (() => void) | undefined) {
  const mounted = new Map<Element, { score: number; dispose: () => void }>();
  let stopped = false, queued = false;
  const scan = () => {
    queued = false;
    if (stopped) return;
    const tags = getAllTags() ?? [];
    const ready = new Map(tags.flatMap(tag => tag.status === 'SUCCEEDED' && Number.isFinite(tag.percentage)
      ? [[tag.element, {tag, score:Math.max(0,Math.min(100,Math.round(tag.percentage!)))}] as const] : []));
    for (const [element, old] of mounted) {
      if (!element.isConnected || ready.get(element)?.score !== old.score) { old.dispose(); mounted.delete(element); }
    }
    for (const [element, value] of ready) if (!mounted.has(element)) {
      const dispose = mount(value.tag, value.score);
      if (dispose) mounted.set(element, {score:value.score,dispose});
    }
  };
  const observer = new MutationObserver(() => {
    if (!queued) { queued = true; queueMicrotask(scan); }
  });
  observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['status','successpercent']});
  scan();
  return () => { stopped=true;observer.disconnect();for(const entry of mounted.values())entry.dispose();mounted.clear(); };
}
