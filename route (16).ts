/* src/app/globals.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy:   #0D1B2A;
  --steel:  #1B6CA8;
  --steel-2:#2481C8;
  --steel-pale: #EFF6FF;
  --amber:  #F59E0B;
  --green:  #059669;
  --red:    #DC2626;
  --surface:#F8FAFC;
  --surface-1:#F1F5F9;
  --white:  #ffffff;
  --border: #E2E8F0;
  --border-strong: #CBD5E1;
  --text:   #0F172A;
  --text-2: #334155;
  --text-3: #64748B;
  --text-4: #94A3B8;
  --font: var(--font-inter), system-ui, sans-serif;
  --radius: 8px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.06);
  --shadow-md: 0 4px 14px rgba(0,0,0,.08);
}

html { scroll-behavior: smooth; }
body { font-family: var(--font); color: var(--text); background: var(--surface);
  -webkit-font-smoothing: antialiased; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }

/* Focus ring */
:focus-visible { outline: 2px solid var(--steel); outline-offset: 2px; }

/* Animations */
@keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
@keyframes spin { to { transform: rotate(360deg); } }
.animate-in { animation: fadeIn .2s ease; }
.spinner { animation: spin 1s linear infinite; }
