import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'

export function VirtualList<T>({ items, rowHeight, render }: { items: T[]; rowHeight: number; render: (item: T, index: number) => ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onScroll = () => setScroll(element.scrollTop)
    const observer = new ResizeObserver(() => setHeight(element.clientHeight || 480))
    element.addEventListener('scroll', onScroll, { passive: true })
    observer.observe(element)
    setHeight(element.clientHeight || 480)
    return () => {
      element.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [])

  const overscan = 8
  const start = Math.max(0, Math.floor(scroll / rowHeight) - overscan)
  const count = Math.ceil(height / rowHeight) + overscan * 2
  const slice = items.slice(start, start + count)

  return (
    <div class="vlist" ref={ref}>
      <div class="vlist-spacer" style={{ height: `${items.length * rowHeight}px` }}>
        {slice.map((item, offset) => (
          <div key={start + offset} class="vlist-row" style={{ transform: `translateY(${(start + offset) * rowHeight}px)`, height: `${rowHeight}px` }}>
            {render(item, start + offset)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function useRowFocus(rowHeight: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onFocus = (event: Event) => {
      const index = (event as CustomEvent<number>).detail
      const scroller = ref.current?.querySelector('.vlist') as HTMLElement | null
      if (!scroller) return
      const top = index * rowHeight
      if (top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - rowHeight) {
        scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3)
      }
      requestAnimationFrame(() => {
        const row = ref.current?.querySelector(`[data-row-index="${index}"]`) as HTMLElement | null
        row?.focus()
      })
    }
    window.addEventListener('leposte-focus-row', onFocus)
    return () => window.removeEventListener('leposte-focus-row', onFocus)
  }, [rowHeight])
  return ref
}
