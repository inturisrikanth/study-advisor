'use client'

import { useEffect } from 'react'
import { supabaseClient as supabase } from '../../lib/supabaseClient'
import Link from "next/link"

export default function Page() {
  useEffect(() => {
    // ===== Constants carried over from your HTML script =====
    const LANDING_URL = `${location.origin}/auth`
    const SOP_PRICE = 1
    const FORM_KEY = 'sop_form_state_v1'
    const RETURN_KEY = 'sop_return_to_panel'

    const el = (id: string) => document.getElementById(id)!

    ;(async () => {
      // 👇 ADD THESE LINES RIGHT HERE (very top of the IIFE)
      try {
        const hadCode = /\b(code|access_token|refresh_token|provider_token)=/.test(location.href);
        await supabase.auth.exchangeCodeForSession(window.location.href);
        if (hadCode) {
            // remove auth params like ?code=… from the URL
            history.replaceState(null, '', '/app');
        }
      } catch {}
      // ===== Auth guard
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { location.href = LANDING_URL; return }

      // Ensure profile row exists & load it
      await supabase.from('profiles').upsert(
        { user_id: user.id, email: user.email },
        { onConflict: 'user_id' }
      )

      let { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle()

      // Backfill name from user metadata
      const metaFirst = (user as any).user_metadata?.first_name || null
      const metaLast  = (user as any).user_metadata?.last_name || null
      if ((!profile?.first_name || !profile?.last_name) && (metaFirst || metaLast)) {
        await supabase.from('profiles').update({ first_name: metaFirst, last_name: metaLast }).eq('user_id', user.id)
        ;({ data: profile } = await supabase
          .from('profiles')
          .select('is_admin, first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle())
      }

      // Header name
      const headerName = (profile?.first_name || profile?.last_name)
        ? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
        : (user.email || 'Signed in')
      el('whoami').innerHTML = headerName +
        (profile?.is_admin ? ' · <span style="border:1px solid #bbb;border-radius:999px;padding:2px 8px;font-size:12px;">Admin</span>' : '')

      // Logout
      el('logoutBtn')?.addEventListener('click', async () => {
        await supabase.auth.signOut()
        location.href = LANDING_URL
      })

      // ===== Panel switching
      async function listSops() {}           // hoisted later
      async function renderSavedPage() {}     // hoisted later
      async function refreshCreditsPill() {}  // hoisted later

      function switchPanel(id: string) {
        const panels = ['howToPanel','universitiesPanel','savedPanel','sopsPanel','mySopsPanel','contactPanel']
        panels.forEach(pid => {
          const elx = document.getElementById(pid)
          if (elx) (elx as HTMLElement).style.display = (pid === id) ? 'block' : 'none'
        })
        document.querySelectorAll('.nav-btn').forEach(btn => {
          (btn as HTMLElement).classList.toggle('active', (btn as HTMLElement).getAttribute('data-target') === id)
        })
        const sopMsgEl = document.getElementById('sop_msg'); if (sopMsgEl) sopMsgEl.textContent = ''
        if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`)
        if (id === 'mySopsPanel') listSops()
        if (id === 'savedPanel') renderSavedPage()
        if (id === 'sopsPanel') refreshCreditsPill()
        localStorage.setItem(RETURN_KEY, id)
      }
      document.querySelectorAll('.nav-btn').forEach(btn => {
        const target = (btn as HTMLElement).getAttribute('data-target')
        if (target) {
          btn.addEventListener('click', () => switchPanel(target))
        }
      })
      const initialHash = (location.hash || '#howToPanel').replace('#', '')
      const initialPanel = ['howToPanel','universitiesPanel','savedPanel','sopsPanel','mySopsPanel','contactPanel'].includes(initialHash)
        ? initialHash
        : (localStorage.getItem(RETURN_KEY) || 'howToPanel')
      switchPanel(initialPanel as string)

      // ===== Credits
      async function getCredits() {
        const { data, error } = await supabase.from('credits').select('balance').eq('user_id', user.id).maybeSingle()
        if (error) { console.error(error); return 0 }
        return data?.balance ?? 0
      }
      async function refreshCreditsPillInner() {
        const bal = await getCredits()
        const span = document.getElementById('creditsBalance')
        if (span) span.textContent = String(bal)
      }
      async function spendCredits(n = 1) {
        const current = await getCredits()
        if (current < n) return { ok:false as const, balance: current }
        const { data, error } = await supabase
          .from('credits')
          .update({ balance: current - n })
          .eq('user_id', user.id)
          .select('balance').single()
        if (error) return { ok:false as const, balance: current }
        await refreshCreditsPillInner()
        return { ok:true as const, balance: (data as any).balance }
      }
      ;(refreshCreditsPill as any) = refreshCreditsPillInner

      // ===== Saved programs
      async function fetchSavedPrograms() {
        const { data, error } = await supabase
          .from('saved_programs')
          .select('program_id, program_name, university_name, saved_at')
          .order('saved_at', { ascending: false })
        if (error) { console.error(error); return [] }
        return data || []
      }
      async function saveProgram({ program_id, program_name, university_name }:{ program_id:string; program_name:string; university_name:string }) {
        const { error } = await supabase.from('saved_programs').insert({
          user_id: user.id, program_id, program_name, university_name
        })
        if (error && !/duplicate key/i.test(error.message)) alert('Save failed: ' + error.message)
        await search()
      }
      async function removeSaved(program_id: string) {
        const { error } = await supabase.from('saved_programs')
          .delete().eq('user_id', user.id).eq('program_id', program_id)
        if (error) alert('Remove failed: ' + error.message)
        await renderSavedPage()
        await search()
      }
      async function removeAllSaved() {
        if (!confirm('Remove all saved programs?')) return
        const { error } = await supabase.from('saved_programs').delete().eq('user_id', user.id)
        if (error) alert('Remove all failed: ' + error.message)
        await renderSavedPage()
        await search()
      }
      async function renderSavedPageInner() {
        const list = el('savedList')
        const empty = el('savedEmpty')
        const title = el('savedTitle')

        list.innerHTML = 'Loading…'
        const rows = await fetchSavedPrograms()

        title.textContent = `Saved Universities${rows.length ? ` (${rows.length})` : ''}`

        if (!rows.length) {
          list.innerHTML = ''
          ;(empty as HTMLElement).style.display = 'block'
          ;(el('goToUnis') as HTMLAnchorElement).onclick = () => switchPanel('universitiesPanel')
          return
        }
        ;(empty as HTMLElement).style.display = 'none'

        list.innerHTML = rows.map((r:any) => `
          <div class="saved-item">
            <div>
              <strong>${r.program_name}</strong> — ${r.university_name}
              <div class="muted">${new Date(r.saved_at).toLocaleString()}</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-primary genFromSaved" data-uni="${r.university_name}" data-name="${r.program_name}">Generate SOP</button>
              <button class="btn btn-danger" data-remove="${r.program_id}">Remove</button>
            </div>
          </div>
        `).join('')

        list.querySelectorAll('.genFromSaved').forEach(btn => {
          btn.addEventListener('click', async () => {
            await prefillSopAndGo({
              university_name: (btn as HTMLElement).getAttribute('data-uni'),
              program_name: (btn as HTMLElement).getAttribute('data-name'),
            })
          })
        })
        list.querySelectorAll('button[data-remove]').forEach(btn => {
          btn.addEventListener('click', async () => {
            await removeSaved((btn as HTMLElement).getAttribute('data-remove')!)
          })
        })

        el('removeAllBtn').onclick = removeAllSaved
      }
      ;(renderSavedPage as any) = renderSavedPageInner

      // ===== Programs dropdown (DB with fallback)
      async function populateProgramsSelect() {
        const select = document.getElementById('program') as HTMLSelectElement | null
        if (!select) return
        try {
          const { data, error } = await supabase
            .from('programs_view')
            .select('name', { count: 'estimated', head: false })
            .order('name', { ascending: true })
            .limit(300)
          if (error || !data?.length) return
          const unique = Array.from(new Set((data as any[]).map(r => r.name).filter(Boolean)))
          select.innerHTML = '<option value="">Any</option>' + unique.map(n => `<option>${n}</option>`).join('')
        } catch (e) {
          console.warn('Program list fallback in use', e)
        }
      }

      // ===== Countries & States dropdowns
      async function populateCountriesSelect() {
        const countrySel = document.getElementById('country') as HTMLSelectElement | null
        if (!countrySel) return
        countrySel.innerHTML = '<option value="">Any</option>'
        try {
          const { data, error } = await supabase
            .from('programs_view')
            .select('country')
            .order('country', { ascending: true })
          if (error) throw error
          const values = (data || []).map((r:any) => r.country).filter(Boolean)
          const uniq = Array.from(new Set(values))
          if (uniq.length) {
            countrySel.innerHTML = '<option value="">Any</option>' +
              uniq.map(v => `<option value="${String(v).trim()}">${String(v).trim()}</option>`).join('')
          }
        } catch (e) {
          console.warn('Country list unavailable. Using "Any" only.', e)
        }
      }
      async function populateStatesSelect() {
        const stateSel = document.getElementById('state') as HTMLSelectElement | null
        const countrySel = document.getElementById('country') as HTMLSelectElement | null
        if (!stateSel) return

        const chosenCountry = (countrySel?.value || '').trim()
        stateSel.innerHTML = '<option value="">Any</option>'

        try {
          let q = supabase
            .from('programs_view')
            .select('state')
            .order('state', { ascending: true })
          if (chosenCountry) q = q.eq('country', chosenCountry)
          const { data, error } = await q
          if (error) throw error
          const values = (data || []).map((r:any) => r.state).filter(Boolean)
          const uniq = Array.from(new Set(values))
          if (uniq.length) {
            stateSel.innerHTML = '<option value="">Any</option>' +
              uniq.map(v => `<option value="${String(v).trim()}">${String(v).trim()}</option>`).join('')
          }
        } catch (e) {
          console.warn('State list unavailable. Using "Any" only.', e)
        }
      }
      document.getElementById('country')?.addEventListener('change', async () => {
        await populateStatesSelect()
      })

      // ===== SOP helpers
      let __prevAnswersLoadedFor: string | null = null

      function clearSopAnswers() {
        ;['sop_goal','sop_ug_college','sop_ug_major','sop_ug_gpa','sop_background','sop_projects','sop_reasons']
          .forEach(id => { const i = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null; if (i) (i as any).value = '' })
        const sopMsgEl = document.getElementById('sop_msg'); if (sopMsgEl) sopMsgEl.textContent = ''
      }
      async function fetchLatestAnswers(uni:string, prog:string) {
        const { data, error } = await supabase
          .from('sops')
          .select('question_answers')
          .eq('user_id', user.id)
          .eq('university_name', uni)
          .eq('program_name', prog)
          .order('created_at', { ascending: false })
          .limit(1)
        if (error) { console.error(error); return null }
        return (data && data[0] && (data[0] as any).question_answers) ? (data[0] as any).question_answers : null
      }
      async function prefillSopAndGo({ university_name, program_name }:{ university_name: string|null, program_name: string|null }) {
        (document.getElementById('sop_uni') as HTMLInputElement).value = university_name || '';
        (document.getElementById('sop_prog') as HTMLInputElement).value = program_name || '';
        clearSopAnswers()

        const usePrevBtn = document.getElementById('usePrev') as HTMLButtonElement
        usePrevBtn.style.display = 'none'
        ;(usePrevBtn as any).dataset.answers = ''

        const prev = await fetchLatestAnswers(university_name || '', program_name || '')
        if (prev) {
          ;(usePrevBtn as any).dataset.answers = JSON.stringify(prev)
          usePrevBtn.style.display = 'inline'
          __prevAnswersLoadedFor = `${university_name}|||${program_name}`
        } else {
          __prevAnswersLoadedFor = null
        }
        switchPanel('sopsPanel')
      }

      function loadFormState() {
        try { const raw = localStorage.getItem(FORM_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
      }
      function saveFormState() {
        const state = {
          uni: (document.getElementById('sop_uni') as HTMLInputElement)?.value?.trim() || '',
          prog: (document.getElementById('sop_prog') as HTMLInputElement)?.value?.trim() || '',
          goal: (document.getElementById('sop_goal') as HTMLTextAreaElement)?.value?.trim() || '',
          ugc:  (document.getElementById('sop_ug_college') as HTMLInputElement)?.value?.trim() || '',
          ugm:  (document.getElementById('sop_ug_major') as HTMLInputElement)?.value?.trim() || '',
          ugg:  (document.getElementById('sop_ug_gpa') as HTMLInputElement)?.value?.trim() || '',
          bg:   (document.getElementById('sop_background') as HTMLTextAreaElement)?.value?.trim() || '',
          prj:  (document.getElementById('sop_projects') as HTMLTextAreaElement)?.value?.trim() || '',
          rsn:  (document.getElementById('sop_reasons') as HTMLTextAreaElement)?.value?.trim() || '',
        }
        localStorage.setItem(FORM_KEY, JSON.stringify(state))
      }
      function hydrateFormFromState() {
        const s = loadFormState(); if (!s) return
        ;(document.getElementById('sop_uni') as HTMLInputElement).value = s.uni || ''
        ;(document.getElementById('sop_prog') as HTMLInputElement).value = s.prog || ''
        ;(document.getElementById('sop_goal') as HTMLTextAreaElement).value = s.goal || ''
        ;(document.getElementById('sop_ug_college') as HTMLInputElement).value = s.ugc || ''
        ;(document.getElementById('sop_ug_major') as HTMLInputElement).value = s.ugm || ''
        ;(document.getElementById('sop_ug_gpa') as HTMLInputElement).value = s.ugg || ''
        ;(document.getElementById('sop_background') as HTMLTextAreaElement).value = s.bg || ''
        ;(document.getElementById('sop_projects') as HTMLTextAreaElement).value = s.prj || ''
        ;(document.getElementById('sop_reasons') as HTMLTextAreaElement).value = s.rsn || ''
      }
      ;['sop_uni','sop_prog','sop_goal','sop_ug_college','sop_ug_major','sop_ug_gpa','sop_background','sop_projects','sop_reasons']
        .forEach(id => document.getElementById(id)?.addEventListener('input', saveFormState))

      hydrateFormFromState()
      const lastPanel = localStorage.getItem(RETURN_KEY)
      if (lastPanel) switchPanel(lastPanel)

      ;['sop_uni','sop_prog'].forEach(id => {
        const input = document.getElementById(id) as HTMLInputElement | null
        if (input) {
          input.addEventListener('input', () => {
            const btn = document.getElementById('usePrev') as HTMLButtonElement | null
            if (btn) { btn.style.display = 'none'; (btn as any).dataset.answers = '' }
            const sopMsgEl = document.getElementById('sop_msg'); if (sopMsgEl) sopMsgEl.textContent = ''
            __prevAnswersLoadedFor = null
          })
          input.addEventListener('focus', () => {
            const sopMsgEl = document.getElementById('sop_msg'); if (sopMsgEl) sopMsgEl.textContent = ''
          })
        }
      })
      ;['sop_goal','sop_ug_college','sop_ug_major','sop_ug_gpa','sop_background','sop_projects','sop_reasons']
        .forEach(id => {
          const input = document.getElementById(id)
          if (input) {
            input.addEventListener('input', () => { const m = document.getElementById('sop_msg'); if (m) m.textContent = '' })
            input.addEventListener('focus', () => { const m = document.getElementById('sop_msg'); if (m) m.textContent = '' })
          }
        })
      document.getElementById('usePrev')?.addEventListener('click', () => {
        const btn = document.getElementById('usePrev') as HTMLButtonElement
        try {
          const prev = (btn as any).dataset.answers ? JSON.parse((btn as any).dataset.answers) : null
          if (prev) {
            ;(document.getElementById('sop_goal') as HTMLTextAreaElement).value = prev.goal || ''
            ;(document.getElementById('sop_ug_college') as HTMLInputElement).value = prev.undergradCollege || ''
            ;(document.getElementById('sop_ug_major') as HTMLInputElement).value = prev.undergradMajor || ''
            ;(document.getElementById('sop_ug_gpa') as HTMLInputElement).value = prev.undergradGPA || ''
            ;(document.getElementById('sop_background') as HTMLTextAreaElement).value = prev.background || ''
            ;(document.getElementById('sop_projects') as HTMLTextAreaElement).value = prev.projects || ''
            ;(document.getElementById('sop_reasons') as HTMLTextAreaElement).value = prev.reasons || ''
            saveFormState()
          }
        } catch {}
        btn.style.display = 'none'
      })

      // ===== Search / Sort / Pagination
      const STATE = {
        page: 1,
        pageSize: 15,
        total: 0,
        lastFilters: null as any,
        lastSort: 'uni_asc',
      }

      function buildFilters() {
        const gre = Number((document.getElementById('gre') as HTMLInputElement)?.value || 0)
        const toefl = Number((document.getElementById('toefl') as HTMLInputElement)?.value || 0)
        const ielts = Number((document.getElementById('ielts') as HTMLInputElement)?.value || 0)
        const duolingo = Number((document.getElementById('duolingo') as HTMLInputElement)?.value || 0)
        const program = (document.getElementById('program') as HTMLSelectElement)?.value
        const state = ((document.getElementById('state') as HTMLSelectElement)?.value || '').trim()
        const country = ((document.getElementById('country') as HTMLSelectElement)?.value || '').trim()
        const onlyGreOptional = (document.getElementById('onlyGreOptional') as HTMLInputElement).checked
        const onlyStem = (document.getElementById('onlyStem') as HTMLInputElement).checked
        return { gre, toefl, ielts, duolingo, program, state, country, onlyGreOptional, onlyStem }
      }

      function applySort(query: any, sortKey: string) {
        switch (sortKey) {
          case 'name_asc': return query.order('name', { ascending: true })
          case 'tuition_asc': return query.order('tuition_usd_per_year', { ascending: true, nullsFirst: true })
          case 'tuition_desc': return query.order('tuition_usd_per_year', { ascending: false, nullsLast: true })
          case 'gre_req': return query.order('gre_required', { ascending: true, nullsFirst: true })
          case 'uni_asc':
          default: return query.order('university_name', { ascending: true })
        }
      }

      function updatePager() {
        const totalPages = Math.max(1, Math.ceil(STATE.total / STATE.pageSize))
        ;(document.getElementById('pageInfo') as HTMLElement).textContent = `Page ${STATE.page} of ${totalPages}`
        ;(document.getElementById('prevPage') as HTMLButtonElement).disabled = (STATE.page <= 1)
        ;(document.getElementById('nextPage') as HTMLButtonElement).disabled = (STATE.page >= totalPages)
      }

      async function search() {
        ;(document.getElementById('status') as HTMLElement).textContent = 'Searching…'
        ;(document.getElementById('results') as HTMLElement).innerHTML = ''

        const f = buildFilters()
        STATE.lastFilters = f

        const from = (STATE.page - 1) * STATE.pageSize
        const to = from + STATE.pageSize - 1

        let base = supabase
          .from('programs_view')
          .select('program_id, university_name, name, gre_required, gre_min_total, english_tests_accepted, toefl_min_total, ielts_min_total, duolingo_min_total, tuition_usd_per_year, website_url, stem, opt_months, state, country', { count: 'exact' })

        if (f.program) base = base.ilike('name', `%${f.program}%`)
        if (f.onlyStem) base = base.eq('stem', 'Y')
        if (f.state) base = base.eq('state', f.state)
        if (f.country) base = base.eq('country', f.country)

        base = applySort(base, STATE.lastSort).range(from, to)

        // Use wide types so fallback reassignment is safe
        const res1 = await base as any
        let data: any[] | null = res1.data ?? null
        let error: any = res1.error ?? null
        let count: number | null = (res1.count ?? null) as number | null

        let usedFallback = false
        if (error && /column.*(state|country)/i.test(error.message)) {
            usedFallback = true
            let q2 = supabase
                .from('programs_view')
                .select('program_id, university_name, name, gre_required, gre_min_total, english_tests_accepted, toefl_min_total, ielts_min_total, duolingo_min_total, tuition_usd_per_year, website_url, stem, opt_months')
            if (f.program) q2 = q2.ilike('name', `%${f.program}%`)
            if (f.onlyStem) q2 = q2.eq('stem', 'Y')
            q2 = applySort(q2, STATE.lastSort).range(from, to)

            const res2 = await q2 as any
            data  = res2.data  ?? null
            error = res2.error ?? null
            count = (res2.count ?? null) as number | null
        }

        if (error) { (document.getElementById('status') as HTMLElement).textContent = 'Error: ' + error.message; return }

        STATE.total = count ?? 0
        updatePager()

        let rows = (data as any[]) || []
        if (usedFallback && (f.state || f.country)) {
          const s = (f.state || '').toLowerCase()
          const c = (f.country || '').toLowerCase()
          rows = rows.filter(row => {
            const hay = `${row.university_name} ${row.name}`.toLowerCase()
            const okS = s ? hay.includes(s) : true
            const okC = c ? hay.includes(c) : true
            return okS && okC
          })
        }

        const filtered = rows.filter((row:any) => {
          if (f.onlyGreOptional && !(row.gre_required === 'optional' || row.gre_required === 'waived')) return false
          if (f.gre && row.gre_required === 'required') {
            if (row.gre_min_total && f.gre < row.gre_min_total) return false
          }
          if (f.toefl && row.toefl_min_total && f.toefl < row.toefl_min_total) return false
          if (f.ielts && row.ielts_min_total && f.ielts < row.ielts_min_total) return false
          if (f.duolingo && row.duolingo_min_total && f.duolingo < row.duolingo_min_total) return false
          return true
        })

        const saved = await fetchSavedPrograms()
        const savedSet = new Set((saved as any[]).map(s => s.program_id))

        ;(document.getElementById('status') as HTMLElement).textContent = `Found ${STATE.total} program(s). Showing ${filtered.length} on this page.`
        renderResults(filtered, savedSet)
      }

      function renderResults(rows:any[], savedSet = new Set<string>()) {
        const container = document.getElementById('results') as HTMLElement
        if (!rows.length) {
          container.innerHTML = '<div class="muted">No results.</div>'
          return
        }
        for (const p of rows) {
          const div = document.createElement('div')
          div.className = 'card'

          const greInfo = `${p.gre_required || 'n/a'}${p.gre_min_total ? ` (min ${p.gre_min_total})` : ''}`
          const engInfo = [
            p.toefl_min_total ? `TOEFL ≥ ${p.toefl_min_total}` : null,
            p.ielts_min_total ? `IELTS ≥ ${p.ielts_min_total}` : null,
            p.duolingo_min_total ? `Duolingo ≥ ${p.duolingo_min_total}` : null
          ].filter(Boolean).join(' • ') || 'n/a'

          const isSaved = savedSet.has(p.program_id)
          const badges = [
            `<span class="badge">${p.stem === 'Y' ? `STEM (OPT ${p.opt_months || 36}m)` : 'Non-STEM'}</span>`,
            isSaved ? '<span class="badge" title="Saved">💾 Saved</span>' : ''
          ].join(' ')

          const actions = isSaved
            ? `<button class="btn btn-outline undo" data-id="${p.program_id}">Undo</button>`
            : `<button class="btn btn-outline save" data-id="${p.program_id}" data-uni="${p.university_name}" data-name="${p.name}">Save</button>`

          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${p.name}</strong> — ${p.university_name}
                <div class="muted" style="margin-top:2px;">
                  ${p.website_url ? `<a href="${p.website_url}" target="_blank" rel="noopener">University site</a>` : ""}
                </div>
              </div>
              <div class="actions">
                ${badges}
                ${actions}
              </div>
            </div>
            <div class="muted" style="margin-top:6px;">
              GRE: ${greInfo} • English: ${engInfo}
              ${p.tuition_usd_per_year ? ` • Tuition ~$${p.tuition_usd_per_year}/yr` : ""}
            </div>
          `
          container.appendChild(div)
        }

        container.querySelectorAll('.save').forEach(btn => {
          btn.addEventListener('click', async () => {
            await saveProgram({
              program_id: (btn as HTMLElement).getAttribute('data-id')!,
              program_name: (btn as HTMLElement).getAttribute('data-name')!,
              university_name: (btn as HTMLElement).getAttribute('data-uni')!,
            })
          })
        })
        container.querySelectorAll('.undo').forEach(btn => {
          btn.addEventListener('click', async () => {
            await removeSaved((btn as HTMLElement).getAttribute('data-id')!)
          })
        })
      }

      // Search & controls
      document.getElementById('searchBtn')?.addEventListener('click', () => { STATE.page = 1; search() })
      document.getElementById('clearBtn')?.addEventListener('click', () => {
        ;['gre','toefl','ielts','duolingo'].forEach(id => { const i = document.getElementById(id) as HTMLInputElement | null; if (i) i.value = '' })
        const programSel = document.getElementById('program') as HTMLSelectElement | null; if (programSel) programSel.value = ''
        const stateSel = document.getElementById('state') as HTMLSelectElement | null; if (stateSel) stateSel.value = ''
        const countrySel = document.getElementById('country') as HTMLSelectElement | null; if (countrySel) countrySel.value = ''
        ;(document.getElementById('onlyGreOptional') as HTMLInputElement).checked = false
        ;(document.getElementById('onlyStem') as HTMLInputElement).checked = false
        ;(document.getElementById('sortBy') as HTMLSelectElement).value = 'uni_asc'
        STATE.page = 1
        STATE.lastSort = 'uni_asc'
        search()
      })
      document.getElementById('sortBy')?.addEventListener('change', (e:any) => {
        STATE.lastSort = e.target.value || 'uni_asc'
        STATE.page = 1
        search()
      })
      document.getElementById('prevPage')?.addEventListener('click', () => {
        if (STATE.page > 1) { STATE.page -= 1; search() }
      })
      document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(STATE.total / STATE.pageSize))
        if (STATE.page < totalPages) { STATE.page += 1; search() }
      })

      // Initial boot
      await populateProgramsSelect()
      await populateCountriesSelect()
      await populateStatesSelect()
      await refreshCreditsPillInner()
      search()

      // ===== AI call helper
      async function generateSopWithAI({ uni, prog, goal, undergradCollege, undergradMajor, undergradGPA, background, projects, reasons }:{
        uni:string, prog:string, goal:string, undergradCollege:string, undergradMajor:string, undergradGPA?:string, background?:string, projects?:string, reasons?:string
      }) {
        const payload = {
          university: uni,
          program: prog,
          goal,
          undergradCollege,
          undergradMajor,
          undergradGPA: undergradGPA || '',
          background: background || '',
          projects: projects || '',
          reasons: reasons || '',
          sampleKey: 'ms-computer-science/sample-001.txt',
          locale: 'en'
        }

        const res = await fetch(`${location.origin}/api/generate-sop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        let data:any = null
        let raw = ''
        try { raw = await res.text(); data = JSON.parse(raw) } catch {}

        if (!res.ok || !data?.ok) {
          const msg = (data?.error || raw || `HTTP ${res.status}`)
          throw new Error(msg)
        }

        const sopText = (data.sop || '').trim()
        if (!sopText) throw new Error('AI returned empty SOP.')
        return sopText
      }

      function safeSlug(s:string) {
        return (s || '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40)
      }

      async function startCheckout(which:'single'|'bundle') {
        try {
          const resp = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              which: which === 'single' ? 'single' : 'bundle',
              userId: user.id,
              email: user.email
            })
          })
          const data = await resp.json().catch(() => ({} as any))
          if (!resp.ok || !data?.ok || !data?.url) throw new Error(data?.error || `HTTP ${resp.status}`)
          window.location.href = data.url
        } catch (e:any) {
          alert('Checkout error: ' + (e?.message || e))
        }
      }

      document.getElementById('buyOneBtn')?.addEventListener('click', () => startCheckout('single'))
      document.getElementById('buyPackBtn')?.addEventListener('click', () => startCheckout('bundle'))

      // SOP Submit
      const sopSubmitBtn = document.getElementById('sop_submit') as HTMLButtonElement | null
      const sopMsg = document.getElementById('sop_msg') as HTMLElement | null

      sopSubmitBtn?.addEventListener('click', async () => {
        const uni = (document.getElementById('sop_uni') as HTMLInputElement)?.value.trim()
        const prog = (document.getElementById('sop_prog') as HTMLInputElement)?.value.trim()
        const goal = (document.getElementById('sop_goal') as HTMLTextAreaElement)?.value.trim()
        const undergradCollege = (document.getElementById('sop_ug_college') as HTMLInputElement)?.value.trim()
        const undergradMajor = (document.getElementById('sop_ug_major') as HTMLInputElement)?.value.trim()
        const undergradGPA = (document.getElementById('sop_ug_gpa') as HTMLInputElement)?.value.trim()
        const background = (document.getElementById('sop_background') as HTMLTextAreaElement)?.value.trim()
        const projects = (document.getElementById('sop_projects') as HTMLTextAreaElement)?.value.trim()
        const reasons = (document.getElementById('sop_reasons') as HTMLTextAreaElement)?.value.trim()

        // Validate required fields
        if (!uni || !prog) { if (sopMsg) sopMsg.textContent = 'Please enter University and Program.'; return }
        if (!goal) { if (sopMsg) sopMsg.textContent = 'Please add your Career goal.'; return }
        if (!undergradCollege || !undergradMajor) { if (sopMsg) sopMsg.textContent = 'Please add your Undergrad college and major/branch.'; return }

        const bal = await getCredits()
        if (bal < SOP_PRICE) {
          if (sopMsg) {
            sopMsg.innerHTML = `You need ${SOP_PRICE} credit. Balance: ${bal}.`
            const inline = document.createElement('div')
            inline.className = 'purchase-bar'
            inline.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-success" id="buyInlineOne">Buy 1 SOP</button>
                  <button class="btn btn-success" id="buyInlinePack">Buy 4 SOPs</button>
                </div>
                <div class="tiny-note">(1 SOP credit = $10 · Bundle: 4 for $30)</div>
              </div>
            `
            sopMsg.appendChild(inline)
            document.getElementById('buyInlineOne')?.addEventListener('click', () => startCheckout('single'))
            document.getElementById('buyInlinePack')?.addEventListener('click', () => startCheckout('bundle'))
          }
          return
        }

        try {
          if (sopMsg) sopMsg.innerHTML = '<span class="status-ai">✨ Generating SOP with AI<span class="dots"></span></span>'

          // 1) Get AI text
          const sopText = await generateSopWithAI({ uni, prog, goal, undergradCollege, undergradMajor, undergradGPA, background, projects, reasons })

          // 2) Word-compatible HTML
          const esc = (t:string) => (t || '-').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          const htmlBody = esc(sopText)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, '<br/>')

          const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" />
<title>Statement of Purpose</title>
<style>
  body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
  h1 { font-size: 18pt; margin: 0 0 8pt; }
  p  { margin: 0 0 10pt; }
</style>
</head>
<body>
  <h1 style="text-align:center; margin-bottom:12pt;">Statement of Purpose</h1>
  <p>${htmlBody}</p>
  <p style="margin-top:18pt;">Sincerely,</p>
  <p><strong>${esc(profile?.first_name || '')} ${esc(profile?.last_name || '')}</strong></p>
</body>
</html>`

          const blob = new Blob([html], { type: 'application/msword' })

          // 3) Upload
          const filename = `sop-${safeSlug(uni)}-${safeSlug(prog)}-${Date.now()}.doc`
          const storagePath = `${user.id}/${filename}`

          const { error: upErr } = await supabase.storage.from('sop_pdfs').upload(
            storagePath, blob, { upsert: false, contentType: 'application/msword' }
          )
          if (upErr) throw upErr

          // 4) Row
          const answers = { goal, undergradCollege, undergradMajor, undergradGPA, background, projects, reasons }
          const { error: rowErr } = await supabase.from('sops').insert({
            user_id: user.id,
            program_id: prog,
            program_name: prog,
            university_name: uni,
            question_answers: answers,
            storage_path: storagePath,
          })
          if (rowErr) throw rowErr

          // 5) Spend credit
          const dec = await spendCredits(SOP_PRICE)
          if (!dec.ok) console.warn('Credit decrement failed; reconcile later')

          // 6) Done
          if (sopMsg) sopMsg.innerHTML = '<span class="status-ai" style="background:#eaf7ef; border-color:#cfe7da;">✅ SOP generated successfully</span>'
          localStorage.removeItem(FORM_KEY)
          clearSopAnswers()
          saveFormState()
          switchPanel('mySopsPanel')
          await listSops()
        } catch (e:any) {
          console.error(e)
          if (sopMsg) sopMsg.textContent = 'AI error: ' + (e?.message || e)
        }
      })

      async function listSopsInner() {
        const box = document.getElementById('sopList') as HTMLElement
        box.textContent = 'Loading…'
        const { data, error } = await supabase
          .from('sops')
          .select('id, program_name, university_name, storage_path, created_at')
          .order('created_at', { ascending: false })
        if (error) { box.textContent = (error as any).message; return }
        if (!data?.length) { box.innerHTML = 'No SOPs yet.'; return }
        box.innerHTML = (data as any[]).map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;">
            <div>
              <strong>${r.program_name}</strong> — ${r.university_name}
              <div class="muted">${new Date(r.created_at).toLocaleString()}</div>
            </div>
            <div><button class="btn btn-success dl" data-path="${r.storage_path}">Download</button></div>
          </div>
        `).join('')
        box.querySelectorAll('.dl').forEach(btn => {
          (btn as HTMLButtonElement).onclick = async () => {
            const path = (btn as HTMLElement).getAttribute('data-path')!
            const { data, error } = await supabase.storage.from('sop_pdfs').download(path)
            if (error) return alert('Download error: ' + (error as any).message)
            const url = URL.createObjectURL(data)
            const a = document.createElement('a'); a.href = url; a.download = path.split('/').pop()!; a.click()
            URL.revokeObjectURL(url)
          }
        })
      }
      ;(listSops as any) = listSopsInner
    })()
  }, [])

  return (
    <main style={{ maxWidth: 1100, margin: '24px auto', padding: '0 16px', fontFamily: 'system-ui, Arial, sans-serif' }}>
      {/* Your original CSS kept inline for now (easy to move out later) */}
      <style>{`
        header { display:flex; justify-content:space-between; align-items:center; margin:12px 0; padding:8px 0; border-bottom:1px solid #eee; }
        .muted { color:#666; font-size: 13px; }
        .row { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; margin: 12px 0; }
        .row label { font-size: 12px; color:#444; display:block; margin-bottom:4px; }
        input, select, button, textarea { padding: 8px; font-size: 14px; }
        textarea { width:100%; min-height:92px; resize: vertical; }
        input, select, textarea { width:100%; box-sizing:border-box; }
        button { cursor: pointer; }
        .card { border:1px solid #ddd; border-radius: 10px; padding: 12px; margin: 10px 0; }
        .badge { display:inline-block; padding:2px 8px; border-radius: 999px; border:1px solid #ccc; font-size:12px; margin-right:6px; }
        a { color:#0a58ca; text-decoration:none; } a:hover { text-decoration: underline; }

        .nav-btn.active { background:#e9ecef !important; }
        @media (max-width: 800px) {
          #dashboard-layout { flex-direction: column; }
          #sidebar { width: 100% !important; border-right: none; border-bottom: 1px solid #ddd; }
        }

        .btn { padding:8px 10px; border:1px solid #ccc; background:#f8f8f8; border-radius:6px; transition: background .15s, border-color .15s, color .15s; }
        .btn:hover { background:#f0f0f0; }
        .btn-primary { background:#0a58ca; color:#fff; border-color:#0a58ca; }
        .btn-primary:hover { background:#094daa; border-color:#094daa; }
        .btn-success { background:#198754; color:#fff; border-color:#198754; }
        .btn-success:hover { background:#166c45; border-color:#166c45; }
        .btn-danger { background:#f8d7da; color:#842029; border-color:#f5c2c7; }
        .btn-danger:hover { background:#f1bfc4; border-color:#e9a7ae; }
        .btn-outline { background:#fff; border-color:#ccc; color:#333; }
        .btn-outline:hover { background:#f8f8f8; }
        .btn.linklike { border:none; background:transparent; color:#0a58ca; padding:0; }
        .btn.linklike:hover { text-decoration: underline; }

        .actions { display:flex; gap:8px; align-items:center; justify-content:flex-end; }
        .saved-list { display:grid; gap:8px; }
        .saved-item { display:flex; justify-content:space-between; align-items:center; border:1px solid #eee; border-radius:8px; padding:8px 10px; background:#fafafa; }
        .toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }

        #howToPanel ol { margin: 8px 0 12px 22px; }
        #howToPanel ol li { margin: 10px 0; line-height: 1.4; }
        .note-box { background:#fff8e6; border:1px solid #ffe0a3; border-radius:8px; padding:10px 12px; color:#664d03; }

        #universitiesPanel .grid-3x2 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; align-items: end; margin-top: 8px; }
        #universitiesPanel .span-2 { grid-column: span 2; }
        #universitiesPanel .span-3 { grid-column: span 3; }
        #universitiesPanel .toggles { margin-top: 14px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
        #universitiesPanel .toggles label { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
        #universitiesPanel .toggles input[type="checkbox"] { width: auto; padding: 0; display: inline-block; vertical-align: middle; }
        #universitiesPanel .toggles label span { white-space: normal; line-height: 1.3; }
        #universitiesPanel .filters-gap { margin: 12px 0; }
        #universitiesPanel #results { margin-top: 18px; }

        .meta-bar { display:flex; align-items:center; justify-content:space-between; margin:12px 0 8px 0; }
        .pager { display:flex; align-items:center; gap:8px; }
        .pager button[disabled] { opacity:.5; cursor:not-allowed; }
        .pager .info { font-size:12px; color:#666; }

        @media (max-width: 680px) {
          #universitiesPanel .grid-3x2 { grid-template-columns: 1fr; }
          #universitiesPanel .span-2, #universitiesPanel .span-3 { grid-column: auto; }
          .meta-bar { flex-direction: column; align-items: flex-start; gap:8px; }
        }

        .credits-pill { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#eef9f2; color:#0f5132; border:1px solid #cfe7da; font-size:13px; }
        .req::after { content:" *"; color:#d6336c; font-weight:600; }
        .optional { color:#666; font-size:12px; margin-left:4px; }
        .section-title { margin: 18px 0 8px; font-weight: 600; color:#333; }

        .status-ai { color:#0f5132; background:#eef9f2; border:1px solid #cfe7da; padding:6px 10px; border-radius:8px; font-size:13px; display:inline-flex; gap:6px; align-items:center; }
        .dots::after { content:"…"; animation: blink 1.2s steps(1) infinite; }
        @keyframes blink { 50% { opacity: 0; } }

        .purchase-bar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:10px; }
        .price-chip { border:1px solid #ddd; border-radius:10px; padding:8px 10px; background:#f9fafb; }
        .tiny-note { font-size:12px; color:#666; }
        details.config { margin-top:8px; } details.config summary { cursor:pointer; color:#0a58ca; }
        .cfg-input { width:280px; }

        .sop-header-line { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
      `}</style>

      {/* ===== Header ===== */}
      <header>
        <div><strong>Study Advisor</strong> — Dashboard</div>
        <div>
          <span id="whoami" className="muted" style={{ marginRight: 12 }} />
          <button id="logoutBtn" className="btn btn-outline">Log out</button>
        </div>
      </header>

      {/* ===== Layout ===== */}
      <div id="dashboard-layout" style={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>
        <aside id="sidebar" style={{ width: 240, background: '#f7f7f7', borderRight: '1px solid #ddd', padding: 16, boxSizing: 'border-box' }}>
          <h3 style={{ marginTop: 0 }}>Study Advisor</h3>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button className="nav-btn active" data-target="howToPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: '#e9ecef', cursor: 'pointer', borderRadius: 6 }}>📘 How to Use</button>
            <button className="nav-btn" data-target="universitiesPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}>🎓 Universities</button>
            <button className="nav-btn" data-target="savedPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}>⭐ Saved</button>
            <button className="nav-btn" data-target="sopsPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}>✍️ SOPs</button>
            <button className="nav-btn" data-target="mySopsPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}>📁 My SOPs</button>
            <Link href="/app/visa" className="nav-btn" style={{ textAlign:'left', padding:'8px 10px', border:'none', background:'transparent', cursor:'pointer', borderRadius:6 }}>
              🛂 Visa Guidance
            </Link>
            <button className="nav-btn" data-target="contactPanel" style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6 }}>📮 Contact Us</button>
          </nav>
        </aside>

        <main id="main-content" style={{ flex: 1, padding: 20 }}>
          {/* HOW TO USE */}
          <section id="howToPanel" style={{ display: 'block' }}>
            <div className="card">
              <h2>How to Use</h2>
              <ol>
                <li>Go to <strong>Universities</strong> → enter your scores and choose a <em>Program</em>, then click <strong>Search</strong>.</li>
                <li>Click <strong>Save</strong> on programs you like — they appear under <strong>Saved</strong>.</li>
                <li>In <strong>Saved</strong>, click <strong>Generate SOP</strong> to open the form with University + Program prefilled.</li>
                <li>Fill your details and click <strong>Continue</strong> to generate the SOP.</li>
                <li>All generated SOPs are listed in <strong>My SOPs</strong>.</li>
              </ol>
              <div className="note-box">
                💡 <strong>Tip:</strong> Don’t want to browse universities? You can <strong>generate an SOP directly</strong> in the <em>SOPs</em> tab — just type your University and Program and continue.
              </div>
            </div>
          </section>

          {/* Universities */}
          <section id="universitiesPanel" style={{ display: 'none' }}>
            <div className="grid-3x2">
              <div>
                <label>GRE score (optional)</label>
                <input id="gre" type="number" placeholder="e.g. 305" />
              </div>
              <div>
                <label>TOEFL score (optional)</label>
                <input id="toefl" type="number" placeholder="e.g. 90" />
              </div>
              <div>
                <label>IELTS score (optional)</label>
                <input id="ielts" type="number" step={0.5} placeholder="e.g. 7.0" />
              </div>
            </div>

            <div className="grid-3x2">
              <div>
                <label>Duolingo score (optional)</label>
                <input id="duolingo" type="number" placeholder="e.g. 115" />
              </div>
              <div>
                <label>State (optional)</label>
                <select id="state" style={{ width: '100%' }}>
                  <option value="">Any</option>
                </select>
              </div>
              <div>
                <label>Country (optional)</label>
                <select id="country" style={{ width: '100%' }}>
                  <option value="">Any</option>
                </select>
              </div>
            </div>

            <div className="grid-3x2">
              <div className="span-3">
                <label>Program</label>
                <select id="program" style={{ width: '100%' }}>
                  <option value="">Any</option>
                  <option>MS Computer Science</option>
                  <option>MS Data Science</option>
                  <option>MS Artificial Intelligence</option>
                  <option>MS Cybersecurity</option>
                  <option>MS Information Systems</option>
                  <option>MS Software Engineering</option>
                  <option>MBA</option>
                </select>
              </div>
            </div>

            <div className="toggles">
              <label className="toggle">
                <input id="onlyGreOptional" type="checkbox" />
                <span>Show programs where GRE is optional/waived</span>
              </label>
              <label className="toggle">
                <input id="onlyStem" type="checkbox" />
                <span>STEM only (OPT 36 months)</span>
              </label>
            </div>

            <div className="filters-gap" style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button id="searchBtn" className="btn btn-primary">Search</button>
              <button id="clearBtn" className="btn btn-outline">Clear</button>
            </div>

            <div className="meta-bar">
              <div>
                <label style={{ fontSize: 12, color: '#444' }}>Sort by</label>
                <select id="sortBy">
                  <option value="uni_asc">University (A–Z)</option>
                  <option value="name_asc">Program (A–Z)</option>
                  <option value="tuition_asc">Tuition (Low → High)</option>
                  <option value="tuition_desc">Tuition (High → Low)</option>
                  <option value="gre_req">GRE requirement (waived/optional first)</option>
                </select>
              </div>
              <div className="pager">
                <button id="prevPage" className="btn btn-outline">‹ Prev</button>
                <span className="info" id="pageInfo">Page 1</span>
                <button id="nextPage" className="btn btn-outline">Next ›</button>
              </div>
            </div>

            <div id="status" className="muted">Ready.</div>
            <div id="results" />
          </section>

          {/* Saved */}
          <section id="savedPanel" style={{ display: 'none' }}>
            <div className="card">
              <div className="toolbar">
                <strong id="savedTitle">Saved Universities</strong>
                <div><button id="removeAllBtn" className="btn btn-danger">Remove all</button></div>
              </div>
              <div id="savedList" className="saved-list" />
              <div id="savedEmpty" className="muted" style={{ display: 'none' }}>
                No saved items yet. Go to <a href="#universitiesPanel" id="goToUnis">Universities</a> to add some.
              </div>
            </div>
          </section>

          {/* SOPs */}
          <section id="sopsPanel" style={{ display: 'none' }}>
            <div className="card">
              <div className="sop-header-line">
                <h2 style={{ margin: '0 0 8px' }}>Generate SOP</h2>
                <span className="credits-pill" title="Credits you can spend on SOPs">
                  💳 Credits: <strong id="creditsBalance">0</strong>
                </span>
              </div>
              <div className="muted" style={{ marginBottom: 12 }}>
                Fields marked with <span style={{ color: '#d6336c' }}>*</span> are required.
              </div>

              <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 14 }}>
                <div>
                  <label className="req">University</label>
                  <input id="sop_uni" type="text" aria-required="true" placeholder="e.g. Northeastern University" />
                </div>
                <div>
                  <label className="req">Program</label>
                  <input id="sop_prog" type="text" aria-required="true" placeholder="e.g. MS in Data Science" />
                </div>
              </div>

              <div className="section-title">Your background</div>
              <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div>
                  <label className="req">Career goal (1–2 lines)</label>
                  <textarea id="sop_goal" aria-required="true" rows={3} placeholder="e.g. Become a data scientist focusing on NLP to build human-centric language tools." />
                </div>
                <div>
                  <label className="req">Undergrad University / College</label>
                  <input id="sop_ug_college" type="text" aria-required="true" placeholder="e.g. VNR VJIET" />
                </div>
              </div>

              <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div>
                  <label className="req">Undergrad Major / Branch</label>
                  <input id="sop_ug_major" type="text" aria-required="true" placeholder="e.g. B.Tech — Computer Science" />
                </div>
                <div>
                  <label>Undergrad GPA / Score <span className="optional">(optional)</span></label>
                  <input id="sop_ug_gpa" type="text" placeholder="e.g. 8.2 / 10 or 3.6 / 4.0" />
                </div>
              </div>

              <div className="section-title">More details (optional)</div>
              <div className="row" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
                <div>
                  <label>Academic background <span className="optional">(optional)</span></label>
                  <textarea id="sop_background" rows={5} placeholder="Key coursework, tools, certifications, clubs… (optional)" />
                </div>
                <div>
                  <label>Key projects / internships <span className="optional">(optional)</span></label>
                  <textarea id="sop_projects" rows={5} placeholder="E.g. CNN for X-ray, 6-month ML internship at Acme (optional)" />
                </div>
              </div>

              <div className="row" style={{ gridTemplateColumns: '1fr' }}>
                <div>
                  <label>Why this university/program? <span className="optional">(optional)</span></label>
                  <textarea id="sop_reasons" rows={5} placeholder="Faculty, labs, co-op, curriculum, location, career outcomes… (optional)" />
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <button id="usePrev" className="btn linklike" style={{ display: 'none' }}>Use previous answers for this program</button>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <button id="sop_submit" className="btn btn-primary">Continue</button>
                <div id="sop_msg" className="muted" />
              </div>

              <div className="muted" style={{ marginTop: 6 }}>✨ Powered by AI — your SOP is uniquely generated.</div>
            </div>
          </section>

          {/* My SOPs */}
          <section id="mySopsPanel" style={{ display: 'none' }}>
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>My SOPs</h2>
              <div id="sopList" className="muted">No SOPs yet.</div>
            </div>
          </section>
          
          {/* Contact Us */}
          <section id="contactPanel" style={{ display: 'none' }}>
            <div className="card">
              <h2 style={{ margin: '0 0 8px' }}>Contact Us</h2>
              <div className="muted" style={{ lineHeight: 1.5 }}>
                For any questions about your account, payments or billing, SOP credits,
                or general support, feel free to reach out to us at{' '}
                <a href="mailto:contact@studyadvisorhub.com">contact@studyadvisorhub.com</a>. 
                We typically respond within 1–2 business days.
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer style={{ textAlign: 'center', fontSize: '0.9rem', padding: '1em 0', color: '#666' }}>
        © 2025 Study Advisor Hub · Contact us at{' '}
        <a href="mailto:contact@studyadvisorhub.com">contact@studyadvisorhub.com</a>
      </footer>
    </main>
  )
}
