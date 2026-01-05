/* Doc2Loc Elite — ui.js (CLEAN V5) */
(function(){
  const $ = (sel, root)=> (root||document).querySelector(sel);
  const $$ = (sel, root)=> Array.from((root||document).querySelectorAll(sel));

  function pageClass(){
    const p = (location.pathname || "").toLowerCase();
    if(p.includes("dashboard")) return "page-dashboard";
    if(p.includes("property")) return "page-property";
    if(p.includes("tenant")) return "page-tenant";
    if(p.includes("login")) return "page-login";
    if(p.includes("register")) return "page-register";
    return "page-generic";
  }

  function ensureOverlay(){
    let o = document.getElementById("navOverlay");
    if(!o){
      o = document.createElement("div");
      o.id = "navOverlay";
      o.className = "nav-overlay";
      document.body.appendChild(o);
    }
    return o;
  }

  function ensureBurger(nav){
    let b = document.getElementById("navBurger");
    if(!b){
      b = document.createElement("button");
      b.id = "navBurger";
      b.className = "nav-burger";
      b.type = "button";
      b.setAttribute("aria-label","Menu");
      b.setAttribute("aria-expanded","false");
      b.innerHTML = "<i data-lucide='menu'></i>";

      const logo = nav.querySelector(".logo");
      if(logo && logo.parentElement === nav) logo.insertAdjacentElement("afterend", b);
      else nav.insertAdjacentElement("afterbegin", b);
    }
    return b;
  }

  // IMPORTANT: on réutilise le wrapper existant (.nav-nav / .nav-links) au lieu de recréer un menu vide
  function ensureMenu(nav){
    let menu =
      nav.querySelector("#navMenu")
      || nav.querySelector(".nav-menu")
      || nav.querySelector(".nav-nav")
      || nav.querySelector(".nav-links");

    if(!menu){
      // fallback : si vraiment pas de wrapper, on en crée un
      menu = document.createElement("div");
      nav.appendChild(menu);
    }
    menu.id = "navMenu";
    menu.classList.add("nav-menu");

    // s'assure que les items ont la classe nav-link (a ou button)
    const logo = nav.querySelector(".logo");
    const logout = nav.querySelector(".logout");

    const candidates = $$(".nav-link, a, button", menu).filter(el=>{
      if(logo && el === logo) return false;
      if(logout && el === logout) return false;
      return true;
    });

    for(const el of candidates){
      if(!el.classList.contains("nav-link")) el.classList.add("nav-link");
    }

    // logout placeholder
    if(logout && !nav.__logoutPlaceholder){
      const ph = document.createComment("logout-placeholder");
      logout.parentNode.insertBefore(ph, logout);
      nav.__logoutPlaceholder = ph;
    }

    // mobile: logout dans menu ; desktop: remet à droite
    function syncLogout(){
      if(!logout) return;
      const isMobile = window.innerWidth <= 768;
      if(isMobile){
        if(!menu.contains(logout)) menu.appendChild(logout);
      }else{
        const ph = nav.__logoutPlaceholder;
        if(ph && ph.parentNode) ph.parentNode.insertBefore(logout, ph.nextSibling);
      }
    }
    syncLogout();
    window.addEventListener("resize", syncLogout);

    return menu;
  }

  function initBurger(){
    const nav = $("nav");
    if(!nav) return;
    nav.classList.add("topnav");

    const menu = ensureMenu(nav);
    const burger = ensureBurger(nav);
    const overlay = ensureOverlay();

    function close(){
      nav.classList.remove("open");
      overlay.classList.remove("show");
      burger.setAttribute("aria-expanded","false");
    }
    function toggle(){
      const open = !nav.classList.contains("open");
      nav.classList.toggle("open", open);
      overlay.classList.toggle("show", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      try{ if(window.lucide && typeof lucide.createIcons==="function") lucide.createIcons(); }catch(e){}
    }

    burger.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); toggle(); });
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") close(); });

    // clic lien -> close
    menu.addEventListener("click", (e)=>{
      const link = e.target && e.target.closest ? e.target.closest("a,button") : null;
      if(link && nav.classList.contains("open")) close();
    });

    // clic dehors -> close (hors nav)
    document.addEventListener("click", (e)=>{
      if(!nav.classList.contains("open")) return;
      if(nav.contains(e.target)) return;
      close();
    });

    window.addEventListener("resize", ()=>{ if(window.innerWidth > 768) close(); });

    try{ if(window.lucide && typeof lucide.createIcons==="function") lucide.createIcons(); }catch(e){}
  }

  function hideLegacyDashboardTop(){
    if(!document.body.classList.contains("page-dashboard")) return;
    const suspects = $$("body *").filter(el=>{
      const t = (el.textContent || "");
      return t.includes("Activité récente") && t.includes("Rafraîchir");
    });
    for(const el of suspects){
      const box = el.closest(".glass-card, .card-premium, section, header, div") || el;
      box.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    document.body.classList.add(pageClass());
    initBurger();
    hideLegacyDashboardTop();
  });
})();


/* DOC2LOC_PORTFOLIO_MOBILE_PREMIUM_V1 */
(function(){
  const $$ = (sel, root)=> Array.from((root||document).querySelectorAll(sel));

  function isMobile(){ return window.innerWidth <= 768; }
  function isDashboard(){ return document.body && document.body.classList.contains("page-dashboard"); }

  function findBtn(btns, predicate){
    for(const b of btns){
      try{ if(predicate(b)) return b; }catch(e){}
    }
    return null;
  }

  function applyPremium(){
    if(!isDashboard() || !isMobile()) return;

    const items = $$(".property-item").filter(el=>!el.dataset.d2lPremium);
    for(const item of items){
      const actions = item.querySelector(".actions");
      if(!actions) { item.dataset.d2lPremium="1"; continue; }

      const btns = Array.from(actions.querySelectorAll("button, a")).filter(x=>x && x.tagName);
      if(btns.length < 2) { item.dataset.d2lPremium="1"; continue; }

      const pdfBtn = findBtn(btns, b=>{
        const oc = (b.getAttribute("onclick")||"");
        const t = (b.getAttribute("title")||"").toLowerCase();
        return oc.includes("pdf(") || t.includes("pdf") || t.includes("quittance");
      });

      const detailsBtn = findBtn(btns, b=>{
        const oc = (b.getAttribute("onclick")||"");
        const t = (b.getAttribute("title")||"").toLowerCase();
        return oc.includes("openProperty(") || t.includes("détails") || t.includes("detail");
      });

      const emailBtn = findBtn(btns, b=>{
        const oc = (b.getAttribute("onclick")||"");
        const t = (b.getAttribute("title")||"").toLowerCase();
        return oc.includes("email(") || t.includes("mail") || t.includes("envoyer");
      });

      const delBtn = findBtn(btns, b=>{
        const oc = (b.getAttribute("onclick")||"");
        const t = (b.getAttribute("title")||"").toLowerCase();
        return oc.includes("del(") || t.includes("supprimer") || t.includes("delete") || t.includes("trash");
      });

      // Create CTA principal "Quittance"
      if(pdfBtn){
        const primary = document.createElement("button");
        primary.type = "button";
        primary.className = "btn-indigo d2l-primary-action";
        primary.innerHTML = "<i data-lucide='file-text'></i><span>Quittance</span>";
        primary.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); pdfBtn.click(); });

        // Hide original pdf icon button
        pdfBtn.style.display = "none";
        actions.insertBefore(primary, actions.firstChild);
      }

      // Kebab + sheet
      const kebab = document.createElement("button");
      kebab.type = "button";
      kebab.className = "btn-icon d2l-kebab";
      kebab.setAttribute("aria-label","Plus d’actions");
      kebab.setAttribute("aria-expanded","false");
      kebab.innerHTML = "<i data-lucide='more-vertical'></i>";

      const sheet = document.createElement("div");
      sheet.className = "d2l-sheet";
      sheet.setAttribute("role","menu");

      function closeSheet(){
        sheet.classList.remove("open");
        kebab.setAttribute("aria-expanded","false");
      }
      function openSheet(){
        // ferme les autres
        document.querySelectorAll(".d2l-sheet.open").forEach(x=>x.classList.remove("open"));
        document.querySelectorAll(".d2l-kebab[aria-expanded='true']").forEach(x=>x.setAttribute("aria-expanded","false"));
        sheet.classList.add("open");
        kebab.setAttribute("aria-expanded","true");
      }

      kebab.addEventListener("click", (e)=>{
        e.preventDefault(); e.stopPropagation();
        if(sheet.classList.contains("open")) closeSheet();
        else openSheet();
        try{ if(window.lucide && typeof lucide.createIcons==="function") lucide.createIcons(); }catch(e){}
      });

      // Build menu entries (call hidden original buttons)
      if(emailBtn){
        emailBtn.style.display = "none";
        const b = document.createElement("button");
        b.type="button";
        b.className="d2l-sheet-btn";
        b.innerHTML = "<i data-lucide='send'></i><span>Envoyer par mail</span>";
        b.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeSheet(); emailBtn.click(); });
        sheet.appendChild(b);
      }

      if(delBtn){
        delBtn.style.display = "none";
        const b = document.createElement("button");
        b.type="button";
        b.className="d2l-sheet-btn danger";
        b.innerHTML = "<i data-lucide='trash-2'></i><span>Supprimer</span>";
        b.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); closeSheet(); delBtn.click(); });
        sheet.appendChild(b);
      }

      // If no entries -> don't add kebab/sheet
      if(sheet.children.length){
        actions.appendChild(sheet);
        actions.appendChild(kebab);
      }

      // Close on outside click
      document.addEventListener("click", (e)=>{
        if(!sheet.classList.contains("open")) return;
        const inside = e.target && e.target.closest && e.target.closest(".d2l-sheet, .d2l-kebab");
        if(!inside) closeSheet();
      });

      // ensure details stays visible (if any)
      if(detailsBtn) detailsBtn.style.display = "";

      item.dataset.d2lPremium="1";
      try{ if(window.lucide && typeof lucide.createIcons==="function") lucide.createIcons(); }catch(e){}
    }
  }

  // apply multiple times (list rendered after fetch)
  document.addEventListener("DOMContentLoaded", ()=>{
    let n=0;
    const t=setInterval(()=>{
      n++; applyPremium();
      if(n>=20) clearInterval(t); // ~10s
    }, 500);
    window.addEventListener("resize", ()=>{ if(isMobile()) applyPremium(); });
  });
})();


/* DOC2LOC_MOBILE_OVERFLOW_FIX_V1 */
(function(){
  const $$ = (sel, root)=> Array.from((root||document).querySelectorAll(sel));
  const isMobile = ()=> window.innerWidth <= 768;

  function isDashboard(){
    return document.body && document.body.classList.contains("page-dashboard");
  }

  function fixCards(){
    if(!isDashboard() || !isMobile()) return;
    // safety net: empêche tout débordement
    $$(".glass-card, .card-premium, .stat-card").forEach(card=>{
      card.style.maxWidth = "100%";
      card.style.overflow = "hidden";
    });
  }

  function fixInsights(){
    if(!isDashboard() || !isMobile()) return;

    const root =
      document.getElementById("insightsWidget")
      || document.querySelector("#insights")
      || document.querySelector(".insights")
      || document.querySelector(".insightsWidget")
      || null;

    if(!root) return;

    // 1) Force wrap sur toutes les lignes flex dans Insights (chips)
    $$(".chips, .pill-row, .badges, .stats, .row", root).forEach(row=>{
      const cs = getComputedStyle(row);
      if(cs.display.includes("flex")){
        row.style.flexWrap = "wrap";
        row.style.gap = row.style.gap || "8px";
        row.style.alignItems = "center";
        row.style.minWidth = "0";
      }
    });

    // 2) Fix "Voir tout" : le mettre en inline-flex et empêcher le débordement
    $$("a,button", root).forEach(el=>{
      const t = (el.textContent || "").trim().toLowerCase();
      if(t.startsWith("voir tout")){
        el.classList.add("d2l-insights-cta");
        el.style.whiteSpace = "nowrap";
        el.style.maxWidth = "100%";
        el.style.display = "inline-flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "flex-end";
      }
    });

    // 3) Dans le cas où CTA est dans la même ligne que chips -> le pousser en bas proprement
    $$(".d2l-insights-cta", root).forEach(cta=>{
      const parent = cta.parentElement;
      if(!parent) return;
      const cs = getComputedStyle(parent);
      if(cs.display.includes("flex")){
        parent.style.flexWrap = "wrap";
        cta.style.marginLeft = "auto";
        cta.style.flex = "0 0 auto";
      }
    });
  }

  function run(){
    fixCards();
    fixInsights();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    let n=0;
    const t=setInterval(()=>{ n++; run(); if(n>=20) clearInterval(t); }, 400); // ~8s
    window.addEventListener("resize", run);
  });
})();


/* DOC2LOC_INSIGHTS_PREMIUM_V1 */
(function(){
  const $$ = (sel, root)=> Array.from((root||document).querySelectorAll(sel));
  const isMobile = ()=> window.innerWidth <= 768;

  function findInsights(){
    const nodes = $$("h1,h2,h3,div,span").filter(el => (el.textContent||"").trim() === "Insights");
    for(const n of nodes){
      const card = n.closest(".glass-card, .card-premium, section, article, .card");
      if(card) return { card, titleNode: n };
    }
    return null;
  }

  function run(){
    if(!document.body.classList.contains("page-dashboard") || !isMobile()) return;

    const found = findInsights();
    if(!found) return;
    const { card, titleNode } = found;

    card.classList.add("d2l-insights-card");

    // 1) Chips: taggage
    $$("a,button,span,div", card).forEach(el=>{
      const t = (el.textContent||"").trim();
      if(t.startsWith("Critiques") || t.startsWith("À surveiller") || t.startsWith("A surveiller") || t.startsWith("Infos")){
        el.classList.add("d2l-chip");
      }
    });

    // 2) Un seul "Voir tout": on garde le premier (comme source de click), on cache les autres
    const ctas = $$("a,button", card).filter(el => (el.textContent||"").trim().toLowerCase().startsWith("voir tout"));
    if(!ctas.length) return;

    const source = ctas[0];
    ctas.forEach((el,i)=>{ el.style.display = "none"; });

    // 3) Ajoute un CTA header (si pas déjà)
    if(!card.querySelector(".d2l-insights-header-cta")){
      const header = titleNode.closest("div") || titleNode.parentElement || card;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "d2l-insights-header-cta";
      btn.textContent = "Voir tout";
      btn.addEventListener("click", (e)=>{ e.preventDefault(); e.stopPropagation(); source.click(); });
      header.appendChild(btn);
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    let n=0;
    const t=setInterval(()=>{ n++; run(); if(n>=20) clearInterval(t); }, 400); // ~8s
    window.addEventListener("resize", run);
  });
})();


/* DOC2LOC_MOBILE_TAGS_V1 */
(function(){
  function isMobile(){ return window.innerWidth <= 768; }

  function tag(){
    if(!isMobile()) return;
    const els = Array.from(document.querySelectorAll("a,button,span,div")).filter(Boolean);

    for(const el of els){
      const t = (el.textContent || "").trim();
      const tl = t.toLowerCase();

      // "Voir tout" (n'importe où sur le dashboard)
      if(tl.startsWith("voir tout")){
        el.classList.add("d2l-cta-viewall");
      }

      // Chips Insights
      if(t.startsWith("Critiques") || t.startsWith("À surveiller") || t.startsWith("A surveiller") || t.startsWith("Infos")){
        el.classList.add("d2l-chip");
      }
    }

    // Bonus : le bouton "Quittance" qu'on a ajouté (si présent)
    document.querySelectorAll(".d2l-primary-action").forEach(b=>{
      b.classList.add("d2l-primary-action");
    });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    tag();
    setTimeout(tag, 600);
    setTimeout(tag, 1600);
    setTimeout(tag, 3200);
  });
  window.addEventListener("resize", tag);
})();
