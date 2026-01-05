(function(){
  // conserve utm dans localStorage (simple)
  const params = new URLSearchParams(location.search);
  const utm = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']
    .reduce((o,k)=>{ if(params.get(k)) o[k]=params.get(k); return o; }, {});
  if(Object.keys(utm).length) localStorage.setItem('utm', JSON.stringify(utm));

  const leadForm = document.querySelector('[data-lead-form]');
  if(leadForm){
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (leadForm.querySelector('input[name="email"]')||{}).value?.trim() || '';
      const source = (leadForm.querySelector('input[name="source"]')||{}).value || location.pathname;
      const msgEl = leadForm.querySelector('[data-lead-msg]');

      const show = (t, ok=true) => {
        if(!msgEl) return;
        msgEl.textContent=t;
        msgEl.style.display='block';
        msgEl.style.color = ok ? '#047857' : '#991B1B';
      };

      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        show("Email invalide : vérifie le format (ex : nom@domaine.com).", false);
        return;
      }

      // tentative API (optionnelle)
      try{
        const r = await fetch('/api/public/lead', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email, source, utm: localStorage.getItem('utm') || null })
        });
        if(r.ok){
          show("Pas de spam. Uniquement pour ton document.");
          leadForm.reset();
          return;
        }
      }catch(_){}

      // fallback : mailto
      const to = 'contact@doc2loc.com';
      const subject = encodeURIComponent('Lead Doc2Loc');
      const body = encodeURIComponent(`Bonjour,\n\nEmail: ${email}\nSource: ${source}\nUTM: ${localStorage.getItem('utm')||''}\n`);
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }
})();
