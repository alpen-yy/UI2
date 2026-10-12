import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { ARTS0, COLS0, DIMS, KINDS, TAGS0, USAGE, colDot, needsAttention, queueStatus, type Article, type Collection, type Dim, type Kind, type Tag } from './data'
import { Collections, Settings, TagLibrary } from './Admin'
import { Workspace } from './Library'
import { SiteWorkspace } from './Sites'
import { Icon, P } from './ui'

type View = 'lib' | 'col' | 'tag' | 'set'
type Quick = 'all' | 'todo'

function usePersisted<T>(key: string, init: T): [T, Dispatch<SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('cairn:' + key)
      return raw ? (JSON.parse(raw) as T) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cairn:' + key, JSON.stringify(v))
    } catch {
      /* 存储不可用时退化为内存状态 */
    }
  }, [key, v])
  return [v, setV]
}

const Group = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
  <div className="mt-6">
    <div className="flex items-center justify-between px-3 mb-1.5">
      <span className="text-[12px] font-medium tracking-[.12em] text-g-sub">{title}</span>
      {right}
    </div>
    {children}
  </div>
)

const Item = ({ on, onClick, icon, dot, children, count }: { on?: boolean; onClick: () => void; icon?: string; dot?: string; children: ReactNode; count?: number | string }) => (
  <button
    onClick={onClick}
    aria-current={on ? 'page' : undefined}
    className={`w-full h-8 px-3 rounded-lg flex items-center gap-2.5 text-[13.5px] text-left transition ${on ? 'bg-g-tint text-g-blue-dark font-medium' : 'text-g-ink hover:bg-black/[.04]'}`}
  >
    {icon && <Icon d={icon} className="w-4 h-4 shrink-0" />}
    {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
    <span className="flex-1 truncate">{children}</span>
    {count !== undefined && <span className={`text-[12px] tabular-nums ${on ? 'text-g-blue-dark' : 'text-g-sub'}`}>{count}</span>}
  </button>
)

type KS = { q: string; quick: Quick; fCol: string | null; fTags: string[]; sel: number | null }
const EMPTY: KS = { q: '', quick: 'all', fCol: null, fTags: [], sel: null }

const matchQ = (a: Article, k: string) =>
  !k || [a.title, a.summary, a.body.join(' '), a.url, a.links.map((l) => l.url + l.label).join(' ')].join(' ').toLowerCase().includes(k)

export default function App() {
  const [view, setView] = useState<View>('lib')
  const [kind, setKind] = useState<Kind>('article')
  const [tags, setTags] = usePersisted<Tag[]>('tags', TAGS0)
  const [cols, setCols] = usePersisted<Collection[]>('cols', COLS0)
  const [arts, setArts] = usePersisted<Article[]>('arts', ARTS0)
  const [ks, setKs] = useState<Record<Kind, KS>>({ article: EMPTY, site: EMPTY })
  const [mode, setMode] = useState<'any' | 'all'>('any')
  const [openDims, setOpenDims] = useState<Dim[]>(['topic'])
  const [navOpen, setNavOpen] = useState(false)
  const [online, setOnline] = usePersisted('online', false)

  const kArts = useMemo(() => arts.filter((a) => a.kind === kind), [arts, kind])
  const kCols = useMemo(() => cols.filter((c) => c.kind === kind), [cols, kind])

  const { q, quick, fTags, sel } = ks[kind]
  // 合集被删除或归档后，残留的筛选 id 视为未筛选，避免列表被清空
  const fCol = ks[kind].fCol && kCols.some((c) => c.id === ks[kind].fCol && !c.archived) ? ks[kind].fCol : null
  const patch = (p: Partial<KS>, k: Kind = kind) => setKs((x) => ({ ...x, [k]: { ...x[k], ...p } }))
  const setQ = (v: string) => patch({ q: v })
  const setQuick = (v: Quick) => patch({ quick: v })
  const setSel = (id: number | null) => patch({ sel: id })

  useEffect(() => setNavOpen(false), [view, kind, fCol, quick])

  const dimOf = (n: string): Dim => tags.find((t) => t.name === n)?.dim ?? 'topic'
  const update = (id: number, f: (a: Article) => Article) => setArts((x) => x.map((a) => (a.id === id ? f(a) : a)))

  const renameTag = (from: string, to: string): string | null => {
    const name = to.trim()
    if (!name) return '名称不能为空'
    if (name === from) return null
    if (tags.some((t) => t.name === name)) return `已存在标签「${name}」`
    setTags((x) => x.map((t) => (t.name === from ? { ...t, name } : t)))
    const swap = (l: string[]) => l.map((t) => (t === from ? name : t))
    setArts((x) => x.map((a) => (a.tags.includes(from) || a.excluded.includes(from) ? { ...a, tags: swap(a.tags), excluded: swap(a.excluded) } : a)))
    setCols((x) => x.map((c) => (c.rule.includes(from) ? { ...c, rule: swap(c.rule) } : c)))
    setKs((x) => ({
      article: { ...x.article, fTags: swap(x.article.fTags) },
      site: { ...x.site, fTags: swap(x.site.fTags) },
    }))
    return null
  }

  const deleteCol = (id: string) => {
    setCols((x) => x.filter((c) => c.id !== id))
    setArts((x) => x.map((a) => (id in a.cols ? { ...a, cols: Object.fromEntries(Object.entries(a.cols).filter(([k]) => k !== id)) } : a)))
    setKs((x) => ({
      article: x.article.fCol === id ? { ...x.article, fCol: null } : x.article,
      site: x.site.fCol === id ? { ...x.site, fCol: null } : x.site,
    }))
  }

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return kArts.filter((a) => {
      if (quick === 'todo' && !needsAttention(a)) return false
      if (!matchQ(a, k)) return false
      if (fTags.length && !(mode === 'any' ? fTags.some((t) => a.tags.includes(t)) : fTags.every((t) => a.tags.includes(t)))) return false
      if (fCol && !(fCol in a.cols)) return false
      return true
    })
  }, [kArts, q, quick, fTags, mode, fCol])

  const otherHits = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return []
    return (Object.keys(KINDS) as Kind[])
      .filter((x) => x !== kind)
      .map((x) => ({ kind: x, n: arts.filter((a) => a.kind === x && matchQ(a, k)).length }))
      .filter((h) => h.n > 0)
  }, [arts, q, kind])

  const filtering = quick !== 'all' || !!fCol || fTags.length > 0 || !!q.trim()
  const clear = () => patch({ quick: 'all', fCol: null, fTags: [], q: '' })
  const pickKind = (k: Kind) => {
    if (k !== kind) {
      setKind(k)
      if (view !== 'lib') setView('lib')
    } else {
      setView('lib')
      patch({ ...EMPTY })
    }
  }
  const jump = (k: Kind) => {
    patch({ q }, k)
    setKind(k)
    setView('lib')
  }
  const openItem = (id: number) => {
    const it = arts.find((a) => a.id === id)
    if (!it) return
    setKind(it.kind)
    setView('lib')
    patch({ sel: id }, it.kind)
  }
  const goLib = (f: () => void) => {
    setView('lib')
    f()
  }
  const toggleTag = (n: string) => goLib(() => patch({ fTags: fTags.includes(n) ? fTags.filter((y) => y !== n) : [...fTags, n] }))

  const activeCols = kCols.filter((c) => !c.archived).sort((a, b) => +b.pinned - +a.pinned)
  const heading = fCol
    ? (cols.find((c) => c.id === fCol)?.name ?? '合集')
    : quick === 'todo'
      ? '待处理'
      : fTags.length
        ? `标签：${fTags.join(' ' + (mode === 'any' ? '或' : '且') + ' ')}`
        : q.trim()
          ? '搜索结果'
          : `全部${KINDS[kind].label}`
  const todo = kArts.filter(needsAttention).length
  const libProps = { kind, arts: kArts, allArts: arts, shown, tags, cols: kCols, q, setQ, sel, setSel, update, dimOf, heading, filtering, clear, quick, setQuick, todo, otherHits, jump, openItem }

  const qs = queueStatus(online)
  const { used, max } = USAGE.classify

  return (
    <div className="h-full grid grid-cols-[248px_1fr] max-[900px]:grid-cols-1">
      {navOpen && <div className="min-[901px]:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setNavOpen(false)} />}
      <aside
        aria-label="侧边栏"
        className={`h-full flex flex-col bg-g-surface border-r border-g-line min-h-0 transition-transform max-[900px]:fixed max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:z-40 max-[900px]:w-[280px] max-[900px]:shadow-2xl ${navOpen ? '' : 'max-[900px]:-translate-x-full'}`}
      >
        <button onClick={() => pickKind(kind)} aria-label="Cairn 首页" className="h-14 px-5 flex items-center gap-2.5 shrink-0">
          <svg viewBox="0 0 32 32" className="w-7 h-7" fill="#1f1f1f" aria-hidden="true">
            <ellipse cx="16" cy="26" rx="12" ry="4.2" />
            <ellipse cx="16.5" cy="18.5" rx="8.5" ry="3.6" />
            <ellipse cx="15.5" cy="12" rx="5.5" ry="3" />
            <ellipse cx="16" cy="7" rx="3" ry="2.3" fill="#0b57d0" />
          </svg>
          <span className="font-serif text-[21px] font-semibold tracking-tight">Cairn</span>
        </button>

        <nav aria-label="资料类型" className="shrink-0 px-3 pb-3 border-b border-g-line">
          <div className="px-3 mb-1.5 text-[12px] font-medium tracking-[.12em] text-g-sub">资料</div>
          <div className="space-y-0.5">
            {(Object.keys(KINDS) as Kind[]).map((k) => {
              const on = kind === k && view === 'lib'
              return (
                <button
                  key={k}
                  onClick={() => pickKind(k)}
                  aria-current={on ? 'page' : undefined}
                  className={`w-full h-10 px-3 rounded-lg flex items-center gap-2.5 text-[14px] text-left transition ${on ? 'bg-g-tint text-g-blue-dark font-medium' : 'text-g-ink hover:bg-black/[.04]'}`}
                >
                  <Icon d={KINDS[k].icon} className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{KINDS[k].label}</span>
                  <span className={`text-[12px] tabular-nums ${on ? 'text-g-blue-dark' : 'text-g-sub'}`}>{arts.filter((a) => a.kind === k).length}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto scroll-quiet px-3 pb-3">
          <Group
            title="合集"
            right={
              <button onClick={() => setView('col')} aria-label="新建合集" className="w-6 h-6 grid place-items-center rounded hover:bg-black/[.06] text-g-sub">
                <Icon d={P.plus} className="w-3.5 h-3.5" />
              </button>
            }
          >
            {activeCols.map((c) => (
              <Item
                key={c.id}
                on={view === 'lib' && fCol === c.id}
                dot={colDot(kCols, c.id)}
                count={kArts.filter((a) => c.id in a.cols).length}
                onClick={() => goLib(() => patch({ quick: 'all', fCol: fCol === c.id ? null : c.id }))}
              >
                {c.name}
              </Item>
            ))}
            {activeCols.length === 0 && <p className="px-3 py-1 text-[12.5px] text-g-sub">还没有合集</p>}
          </Group>

          <Group
            title="标签"
            right={
              <div role="group" aria-label="多标签匹配方式" className="flex rounded-full bg-black/[.06] p-px text-[12px]">
                {(['any', 'all'] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-2 h-5 rounded-full ${mode === m ? 'bg-white shadow-sm text-g-text font-medium' : 'text-g-sub'}`}>
                    {m === 'any' ? '任一' : '全部'}
                  </button>
                ))}
              </div>
            }
          >
            {(Object.keys(DIMS) as Dim[]).map((d) => {
              const open = openDims.includes(d)
              const list = tags.filter((t) => t.dim === d && t.enabled && kArts.some((a) => a.tags.includes(t.name)))
              return (
                <div key={d}>
                  <button
                    onClick={() => setOpenDims((x) => (open ? x.filter((y) => y !== d) : [...x, d]))}
                    aria-expanded={open}
                    className="w-full h-7 px-3 flex items-center gap-1.5 text-[12.5px] text-g-sub hover:text-g-text"
                  >
                    <Icon d="M9 6l6 6-6 6" className={`w-3 h-3 transition ${open ? 'rotate-90' : ''}`} />
                    {DIMS[d].label}
                    <span className="ml-auto text-[12px]">{list.length}</span>
                  </button>
                  {open && (
                    <div className="flex flex-wrap gap-1 pl-7 pr-2 pb-2 pt-0.5">
                      {list.map((t) => {
                        const on = fTags.includes(t.name)
                        const n = kArts.filter((a) => a.tags.includes(t.name)).length
                        return (
                          <button
                            key={t.name}
                            onClick={() => toggleTag(t.name)}
                            aria-pressed={on}
                            className={`h-6 px-2.5 rounded-full text-[12px] border transition ${on ? 'bg-g-blue border-g-blue text-white' : 'border-[#d3d6da] bg-white hover:border-g-mute'}`}
                          >
                            {t.name} <span className={on ? 'text-white/70' : 'text-g-sub'}>{n}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </Group>

          <Group title="管理">
            <Item on={view === 'col'} icon="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" onClick={() => setView('col')}>
              {KINDS[kind].label}合集管理
            </Item>
            <Item on={view === 'tag'} icon="M3 12V4h8l10 10-8 8zM7.5 8.5h.01" onClick={() => setView('tag')}>
              标签库
            </Item>
          </Group>
        </div>

        <button onClick={() => setView('set')} aria-current={view === 'set' ? 'page' : undefined} className="shrink-0 m-3 p-3.5 rounded-xl bg-white border border-g-line text-left hover:shadow-sm transition">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-g-ok' : 'bg-g-amber'}`} /> {online ? '后台运转正常' : '部分任务重试中'}
            <span className="ml-auto text-g-sub font-normal">
              排队 {qs.queued} · 重试 {qs.retry}
            </span>
          </div>
          <div className="mt-2.5 flex justify-between text-[12px] text-g-sub">
            <span>今日分类调用</span>
            <span className="tabular-nums">
              {used} / {max}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-g-surface overflow-hidden">
            <div className="h-full bg-g-blue" style={{ width: (used / max) * 100 + '%' }} />
          </div>
        </button>
      </aside>

      <main className="min-w-0 min-h-0 bg-white flex flex-col">
        <header className="min-[901px]:hidden h-12 shrink-0 flex items-center gap-1 px-2 border-b border-g-line">
          <button onClick={() => setNavOpen(true)} aria-label="打开导航" className="w-10 h-10 grid place-items-center rounded-full hover:bg-g-surface">
            <Icon d="M4 7h16M4 12h16M4 17h16" className="w-5 h-5" />
          </button>
          <span className="font-serif text-[18px] font-semibold">Cairn</span>
          <span className="text-[13px] text-g-sub ml-2">{view === 'set' ? '设置与状态' : view === 'col' ? '合集管理' : view === 'tag' ? '标签库' : KINDS[kind].label}</span>
        </header>
        <div className="flex-1 min-h-0">
          {view === 'lib' && kind === 'article' && <Workspace {...libProps} />}
          {view === 'lib' && kind === 'site' && <SiteWorkspace {...libProps} />}
          {view === 'col' && <Collections key={kind} {...{ kind, cols: kCols, setCols, arts: kArts, tags, setArts, deleteCol }} />}
          {view === 'tag' && <TagLibrary {...{ tags, setTags, arts, renameTag }} />}
          {view === 'set' && <Settings online={online} setOnline={setOnline} />}
        </div>
      </main>
    </div>
  )
}
