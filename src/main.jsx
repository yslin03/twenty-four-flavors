import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const seasons = [
  { tag: 'SPRING', term: '立春', accent: '春生', title: '青梅酒酿锅', note: '微酸开胃，佐以时令青蔬', ingredients: ['安吉春笋', '云南鸡枞菌', '手打虾滑'], desc: '取新梅的清冽与米酿的圆润，第一口便是春日破土的鲜。' },
  { tag: 'SUMMER', term: '夏至', accent: '夏长', title: '花椒青柠锅', note: '清麻鲜香，爽利不燥', ingredients: ['青花椒牛肉', '冰鲜黄喉', '藤椒鱼片'], desc: '以川西青花椒的麻香，唤醒一席盛夏的清凉与恣意。' },
  { tag: 'AUTUMN', term: '秋分', accent: '秋收', title: '菌王松茸锅', note: '山野醇厚，秋意正浓', ingredients: ['当日松茸', '黑猪梅花肉', '高山羊肚菌'], desc: '四方山野的香气，在一盏金汤中慢慢舒展，丰收有了形状。' },
  { tag: 'WINTER', term: '大雪', accent: '冬藏', title: '陈皮老火锅', note: '温润回甘，围炉相聚', ingredients: ['潮汕牛肉丸', '广式腊味', '雪山牦牛肉'], desc: '三年陈皮与慢熬骨汤相遇，暖意从舌尖蔓延到心里。' }
]

const stores = [
  ['静安公馆', '上海市静安区愚园路 88 号', '11:00 — 23:00'],
  ['湖畔里', '杭州市西湖区北山街 28 号', '11:00 — 22:30'],
  ['宽窄之间', '成都市青羊区同仁路 66 号', '11:00 — 23:30']
]

function ReservationModal({ close }) {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && close()
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [close])
  const submit = (event) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    if ([...values.values()].some((value) => !String(value).trim())) return setError('请完整填写预约信息。')
    setError('')
    setSent(true)
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
    <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
      <button className="modal-close" onClick={close} aria-label="关闭预约窗口">×</button>
      {sent ? <div className="success-state"><span>✦</span><p className="eyebrow">RESERVATION RECEIVED</p><h2>静候您入席</h2><p>这是一次演示预约，我们不会保存或传输您的信息。期待在二十四味与您围炉相见。</p><button className="button button-solid" onClick={close}>回到首页</button></div> : <>
        <p className="eyebrow">RESERVATION</p><h2 id="reservation-title">预留一席四时好味</h2><p className="modal-intro">请留下信息，店内管家将于营业时间内致电确认。</p>
        <form onSubmit={submit}>
          <label>您的称呼<input name="name" placeholder="请输入姓名" /></label>
          <label>联系电话<input name="phone" type="tel" placeholder="请输入手机号" /></label>
          <div className="form-grid"><label>到店日期<input name="date" type="date" /></label><label>用餐人数<select name="guests" defaultValue=""><option value="" disabled>请选择</option><option>2 位</option><option>3–4 位</option><option>5–6 位</option><option>7 位及以上</option></select></label></div>
          <label>意向门店<select name="store" defaultValue=""><option value="" disabled>请选择门店</option>{stores.map(([name]) => <option key={name}>{name}</option>)}</select></label>
          {error && <p className="form-error">{error}</p>}<button className="button button-solid form-submit" type="submit">提交预约</button>
        </form>
      </>}
    </section>
  </div>
}

function App() {
  const [openMenu, setOpenMenu] = useState(false)
  const [selected, setSelected] = useState(0)
  const [reservation, setReservation] = useState(false)
  const reserve = () => { setReservation(true); setOpenMenu(false) }
  return <>
    <header className="site-header"><a href="#home" className="brand" aria-label="二十四味首页"><span>二十四味</span><small>24 FLAVORS</small></a>
      <button className="menu-toggle" onClick={() => setOpenMenu(!openMenu)} aria-expanded={openMenu} aria-label="切换导航"><i></i><i></i></button>
      <nav className={openMenu ? 'open' : ''}><a href="#philosophy" onClick={() => setOpenMenu(false)}>关于二十四味</a><a href="#menu" onClick={() => setOpenMenu(false)}>节气之味</a><a href="#space" onClick={() => setOpenMenu(false)}>门店空间</a><button onClick={reserve}>立即订位 <span>↗</span></button></nav>
    </header>
    <main>
      <section className="hero" id="home"><div className="hero-paper"></div><div className="hero-content"><p className="eyebrow">SEASONAL HOTPOT · EST. 2024</p><h1>一锅<br/><em>知</em>四时</h1><p className="hero-copy">以二十四节气为序，寻山野之鲜，<br/>烹一席恰逢其时的好味。</p><button className="button button-outline" onClick={reserve}>预留席位 <span>↗</span></button></div><div className="hero-art" aria-label="铜锅与蒸汽的抽象视觉"><div className="steam steam-a"></div><div className="steam steam-b"></div><div className="steam steam-c"></div><div className="pot"><div></div></div><p>立春 · 夏至 · 秋分 · 大雪</p></div><a className="scroll-cue" href="#philosophy"><span></span>向下探寻</a></section>
      <section className="philosophy section" id="philosophy"><div className="section-label"><span>01</span><i></i> BRAND PHILOSOPHY</div><div className="philosophy-grid"><div className="vertical-title">循时<br/>而食</div><div className="philosophy-copy"><p className="large-copy">我们相信，<br/>食材有自己的<strong>时令。</strong></p><p>二十四味以节气为经、山海为纬。每一季的锅底与食材，顺应自然的节律生长、抵达与相逢。不是追赶潮流，只在恰当的时刻，款待一口真正的鲜。</p><a href="#menu" className="text-link">探寻节气风味 <span>→</span></a></div><div className="seal"><span>二十四</span><span>味</span><i>SEASONAL<br/>TABLE</i></div></div></section>
      <section className="menu-section section" id="menu"><div className="section-heading"><div className="section-label"><span>02</span><i></i> MENU OF THE SEASONS</div><h2>一席一节气<br/><em>一味一相逢</em></h2></div><div className="season-tabs" role="tablist">{seasons.map((item, index) => <button className={selected === index ? 'active' : ''} onClick={() => setSelected(index)} key={item.term} role="tab" aria-selected={selected === index}><span>{item.tag}</span>{item.term}</button>)}</div><article className={`season-card season-${selected}`}><div className="season-numeral">{String(selected + 1).padStart(2, '0')}</div><div className="season-content"><p className="eyebrow">{seasons[selected].accent} · {seasons[selected].tag}</p><h3>{seasons[selected].title}</h3><p className="season-note">{seasons[selected].note}</p><p className="season-desc">{seasons[selected].desc}</p><ul>{seasons[selected].ingredients.map((item) => <li key={item}>✦ {item}</li>)}</ul></div><div className="season-visual"><div className="bowl"><span></span><span></span><span></span></div><p>{seasons[selected].term}</p></div></article></section>
      <section className="ingredients"><div className="ingredients-top"><p className="eyebrow">FROM MOUNTAIN TO TABLE</p><h2>来自土地的<br/><em>四时馈赠</em></h2><p>从各地甄选当令食材，<br/>让风土成为每一口的注脚。</p></div><div className="ingredient-list"><div><b>01</b><span>高山松茸</span><small>云南 · 秋</small></div><div><b>02</b><span>安吉春笋</span><small>浙江 · 春</small></div><div><b>03</b><span>青花椒</span><small>四川 · 夏</small></div><div><b>04</b><span>陈年新会柑</span><small>广东 · 冬</small></div></div></section>
      <section className="space section" id="space"><div className="section-heading"><div className="section-label"><span>03</span><i></i> THE SPACE</div><h2>围一方炉火<br/><em>见一味东方</em></h2></div><div className="space-composition"><div className="space-art large-art"><span>山</span><i></i></div><div className="space-copy"><p>以现代手法重述东方待客之道。深木、粗陶、手工纸与一盏暖灯，让每一次相聚都慢下来。</p><a className="text-link" href="#stores">查看附近门店 <span>→</span></a></div><div className="space-art small-art"><span>炉</span></div></div></section>
      <section className="story"><div className="story-mark">24</div><div><p className="eyebrow">OUR STORY</p><h2>把时间的味道，<br/>煮给懂得的人。</h2><p>我们从一张节气食单开始，走过山林、菜场与旧时巷陌。如今，愿以一席沸腾的锅，留住季节的真实，也留住人与人相聚时的热气。</p></div></section>
      <section className="stores section" id="stores"><div className="section-heading"><div className="section-label"><span>04</span><i></i> FIND A TABLE</div><h2>在城市里<br/><em>等一场相逢</em></h2></div><div className="store-grid">{stores.map(([name, address, hours], index) => <article key={name}><p>0{index + 1}</p><h3>{name}</h3><address>{address}</address><small>{hours}</small><button onClick={reserve}>预约此店 <span>↗</span></button></article>)}</div></section>
      <section className="cta"><p className="eyebrow">TASTE THE RIGHT SEASON</p><h2>好味，不必等候</h2><p>此刻正好，来赴一场属于四时的宴。</p><button className="button button-light" onClick={reserve}>立即订位 <span>↗</span></button></section>
    </main>
    <footer><a href="#home" className="brand"><span>二十四味</span><small>24 FLAVORS</small></a><p>循时而食 · 围炉相聚</p><div><a href="#home">微博</a><a href="#home">小红书</a><a href="mailto:hello@24flavors.example">联系</a></div><small>© 2024 二十四味 · 本网站为品牌展示演示</small></footer>
    {reservation && <ReservationModal close={() => setReservation(false)} />}
  </>
}

createRoot(document.getElementById('root')).render(<App />)
